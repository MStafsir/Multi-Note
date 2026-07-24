// ============================================================
// MODUL 42.2: Billing Webhook Handler — Provider Event Processing
// PUBLIC endpoint (no auth required — provider sends events)
// Idempotency key check to prevent double-processing
// 42.3 — Grace period: 3-day window before downgrade enforcement
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Webhook event types from billing providers
const webhookEventSchema = z.object({
  type: z.enum(['invoice.paid', 'invoice.payment_failed', 'subscription.deleted']),
  id: z.string().min(1), // idempotency key from provider
  data: z.object({
    object: z.object({
      subscription_id: z.string().optional(),
      customer_id: z.string().optional(),
      workspace_id: z.string().optional(),
    }).passthrough(),
  }).passthrough(),
});

// POST /api/workspaces/[id]/subscription/webhook — Public webhook handler (42.2)
export async function POST(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const ctx = context as { params: Promise<{ id: string }> };
    const { id: workspaceId } = await ctx.params;

    const body = await request.json();

    // Validate event structure
    const validated = webhookEventSchema.parse(body);

    // Idempotency key: event type + provider event ID
    const idempotencyKey = `${validated.type}:${validated.id}`;

    // Check if we've already processed this event
    const existingSubscription = await db.workspaceSubscription.findFirst({
      where: { workspaceId },
    });

    if (!existingSubscription) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'no_subscription_found' } });
    }

    // Simple idempotency check — use subscription metadata
    // We store the last processed event ID in providerSubscriptionId or similar
    // For SQLite simplicity, we check providerSubscriptionId as idempotency marker
    if (existingSubscription.providerSubscriptionId === idempotencyKey) {
      logger.info('webhook_idempotency_skip', { workspaceId, idempotencyKey });
      return NextResponse.json({ success: true, data: { processed: false, reason: 'already_processed' } });
    }

    // Process based on event type
    switch (validated.type) {
      case 'invoice.paid':
        // 42.2 — Payment successful → status='active', clear grace period
        await db.workspaceSubscription.update({
          where: { id: existingSubscription.id },
          data: {
            status: 'active',
            gracePeriodEnd: null,
            providerSubscriptionId: idempotencyKey, // idempotency marker
            updatedAt: new Date(),
          },
        });

        logger.info('webhook_invoice_paid', { workspaceId, idempotencyKey });
        break;

      case 'invoice.payment_failed':
        // 42.3 — Payment failed → status='past_due', start 3-day grace period
        const gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

        await db.workspaceSubscription.update({
          where: { id: existingSubscription.id },
          data: {
            status: 'past_due',
            gracePeriodEnd,
            providerSubscriptionId: idempotencyKey, // idempotency marker
            updatedAt: new Date(),
          },
        });

        logger.info('webhook_invoice_payment_failed', { workspaceId, idempotencyKey, gracePeriodEnd: gracePeriodEnd.toISOString() });
        break;

      case 'subscription.deleted':
        // 42.2 — Subscription canceled → status='canceled', cancelAtPeriodEnd=true
        await db.workspaceSubscription.update({
          where: { id: existingSubscription.id },
          data: {
            status: 'canceled',
            cancelAtPeriodEnd: true,
            providerSubscriptionId: idempotencyKey, // idempotency marker
            updatedAt: new Date(),
          },
        });

        // Also update workspace planTier back to free
        await db.workspace.update({
          where: { id: workspaceId },
          data: { planTier: 'free' },
        });

        logger.info('webhook_subscription_deleted', { workspaceId, idempotencyKey });
        break;

      default:
        logger.warn('webhook_unhandled_event_type', { workspaceId, eventType: validated.type });
    }

    return NextResponse.json({ success: true, data: { processed: true, eventType: validated.type } });
  } catch (error: unknown) {
    logger.error('webhook_billing_handler_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
