// ============================================================
// MODUL 44: Webhook Dispatch Engine
// 44.2 — Main dispatch function: called after logActivity()
// 44.3 — HMAC-SHA256 signature: X-Webhook-Signature header
// 44.4 — Retry policy: exponential backoff, max 5 attempts
// After 5 failures: status='dead_letter', notify owner
// ============================================================

import { db } from '@/lib/db';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { createNotification } from '@/lib/notification-sender';
import type { WebhookEventType } from '@/types';

// 44.4 — Max retry attempts before dead-letter
const MAX_ATTEMPTS = 5;

// 44.4 — Exponential backoff base delay (seconds)
const BASE_BACKOFF_SECONDS = 30;

/**
 * Calculate next attempt time using exponential backoff.
 * Attempt 1: 30s, Attempt 2: 60s, Attempt 3: 120s, Attempt 4: 240s
 */
function getNextAttemptAt(attemptCount: number): Date {
  const delaySeconds = BASE_BACKOFF_SECONDS * Math.pow(2, attemptCount - 1);
  const nextAt = new Date();
  nextAt.setTime(nextAt.getTime() + delaySeconds * 1000);
  return nextAt;
}

/**
 * 44.3 — HMAC-SHA256 signature for webhook payload.
 * Header: X-Webhook-Signature = hex(HMAC-SHA256(secret, JSON.stringify(payload)))
 */
export function signPayload(secret: string, payload: Record<string, unknown>): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * 44.2 — Main dispatch function.
 * Called after logActivity() or any mutation that should trigger webhooks.
 *
 * Finds matching active subscriptions, creates delivery records, sends HTTP POST.
 */
export async function dispatchWebhooks(
  eventType: string,
  nodeId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Build the full webhook payload with metadata
    const webhookPayload = {
      event: eventType,
      nodeId,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    // Find all active subscriptions that match this event type
    // We need to check both personal (ownerId-based) and workspace subscriptions
    const activeSubscriptions = await db.webhookSubscription.findMany({
      where: { isActive: true },
      select: {
        id: true,
        ownerId: true,
        workspaceId: true,
        targetUrl: true,
        secret: true,
        eventTypes: true,
      },
    });

    // Filter subscriptions that include this event type
    const matchingSubscriptions = activeSubscriptions.filter(sub => {
      const eventTypes: WebhookEventType[] = JSON.parse(sub.eventTypes) as WebhookEventType[];
      return eventTypes.includes(eventType as WebhookEventType);
    });

    if (matchingSubscriptions.length === 0) {
      logger.debug('webhook_no_matching_subscriptions', { eventType, nodeId });
      return;
    }

    logger.info('webhook_dispatching', {
      eventType,
      nodeId,
      matchingSubscriptions: matchingSubscriptions.length,
    });

    // For each matching subscription, create a delivery record and send
    for (const subscription of matchingSubscriptions) {
      // Create delivery record (pending status)
      const delivery = await db.webhookDelivery.create({
        data: {
          subscriptionId: subscription.id,
          eventType,
          payload: JSON.stringify(webhookPayload),
          attemptCount: 0,
          status: 'pending',
          nextAttemptAt: new Date(), // attempt immediately
        },
      });

      // Attempt to send
      await attemptDelivery(delivery.id, subscription.targetUrl, subscription.secret, webhookPayload);
    }
  } catch (error: unknown) {
    logger.error('webhook_dispatch_failed', { eventType, nodeId }, error);
  }
}

/**
 * Attempt to deliver a webhook to the target URL.
 * On success: update delivery status to 'success'.
 * On failure: increment attempt count, schedule next attempt or mark dead_letter.
 */
async function attemptDelivery(
  deliveryId: string,
  targetUrl: string,
  secret: string,
  payload: Record<string, unknown>
): Promise<void> {
  const payloadString = JSON.stringify(payload);

  // Sign the payload
  const signature = signPayload(secret, payload);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event as string,
        'X-Webhook-Delivery-Id': deliveryId,
      },
      body: payloadString,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    responseStatus = response.status;
    responseBody = await response.text().catch(() => null);

    // 2xx = success
    if (responseStatus >= 200 && responseStatus < 300) {
      success = true;
    }
  } catch (error: unknown) {
    // Network error or timeout
    logger.warn('webhook_delivery_network_error', { deliveryId, targetUrl }, error);
  }

  // Get current delivery record
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { attemptCount: true },
  });

  if (!delivery) return;

  const newAttemptCount = delivery.attemptCount + 1;

  if (success) {
    // Mark as success
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'success',
        responseStatus,
        responseBody: responseBody ? truncateResponseBody(responseBody) : null,
        attemptCount: newAttemptCount,
        nextAttemptAt: null, // no more attempts needed
      },
    });

    logger.info('webhook_delivery_success', { deliveryId, targetUrl, responseStatus });
  } else {
    // Check if we've exhausted retries
    if (newAttemptCount >= MAX_ATTEMPTS) {
      // 44.4 — Mark as dead_letter after max attempts
      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'dead_letter',
          responseStatus,
          responseBody: responseBody ? truncateResponseBody(responseBody) : null,
          attemptCount: newAttemptCount,
          nextAttemptAt: null,
        },
      });

      logger.warn('webhook_delivery_dead_letter', { deliveryId, targetUrl, attempts: newAttemptCount });

      // Find the subscription owner and notify them
      const subscription = await db.webhookSubscription.findUnique({
        where: { id: (await db.webhookDelivery.findUnique({ where: { id: deliveryId }, select: { subscriptionId: true } }))!.subscriptionId },
        select: { ownerId: true },
      });

      if (subscription?.ownerId) {
        await createNotification({
          recipientId: subscription.ownerId,
          type: 'monitoring_alert',
          payload: {
            message: `Webhook delivery failed after ${MAX_ATTEMPTS} attempts. Delivery ID: ${deliveryId}. Target: ${targetUrl}. Event: ${payload.event}. The webhook has been marked as dead letter.`,
            deliveryId,
            targetUrl,
          },
        });
      }
    } else {
      // Schedule next attempt with exponential backoff
      const nextAttemptAt = getNextAttemptAt(newAttemptCount);

      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          responseStatus,
          responseBody: responseBody ? truncateResponseBody(responseBody) : null,
          attemptCount: newAttemptCount,
          nextAttemptAt,
        },
      });

      logger.info('webhook_delivery_retry_scheduled', {
        deliveryId,
        targetUrl,
        attempt: newAttemptCount,
        nextAttemptAt: nextAttemptAt.toISOString(),
      });
    }
  }
}

/**
 * Truncate response body to prevent oversized storage.
 * Max 2000 chars for audit trail.
 */
function truncateResponseBody(body: string): string {
  const MAX_LENGTH = 2000;
  if (body.length > MAX_LENGTH) {
    return body.substring(0, MAX_LENGTH) + '...[truncated]';
  }
  return body;
}

/**
 * Process pending and failed webhook deliveries (for cron endpoint).
 * Finds deliveries where status='pending' or 'failed' with nextAttemptAt <= now.
 * Sends each, updates status.
 * After max attempts → dead_letter + notification.
 */
export async function processPendingDeliveries(): Promise<{ processed: number }> {
  const now = new Date();

  // Find deliveries that are ready for processing
  const pendingDeliveries = await db.webhookDelivery.findMany({
    where: {
      OR: [
        { status: 'pending' },
        {
          status: 'failed',
          nextAttemptAt: { lte: now },
        },
      ],
    },
    include: {
      subscription: {
        select: {
          targetUrl: true,
          secret: true,
          ownerId: true,
        },
      },
    },
    take: 50, // Process up to 50 per batch to avoid overload
  });

  logger.info('webhook_processing_deliveries', { count: pendingDeliveries.length });

  let processed = 0;

  for (const delivery of pendingDeliveries) {
    try {
      const payload = JSON.parse(delivery.payload) as Record<string, unknown>;
      await attemptDelivery(
        delivery.id,
        delivery.subscription.targetUrl,
        delivery.subscription.secret,
        payload
      );
      processed++;
    } catch (error: unknown) {
      logger.error('webhook_process_delivery_error', { deliveryId: delivery.id }, error);
    }
  }

  return { processed };
}
