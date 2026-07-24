// ============================================================
// MODUL 44: Webhook Subscription Detail — GET, PATCH, DELETE
// 44.1 — GET: Get webhook subscription detail
// 44.1 — PATCH: Update targetUrl, eventTypes, isActive toggle
// 44.1 — DELETE: Delete webhook subscription
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { z } from 'zod';
import type { WebhookEventType } from '@/types';

// 44.1 — Update webhook schema
const updateWebhookSchema = z.object({
  targetUrl: z.string().url('Must be a valid URL').optional(),
  eventTypes: z.array(z.enum(['node.created', 'node.deleted', 'note.updated', 'file.uploaded'])).min(1, 'At least one event type required').optional(),
  isActive: z.boolean().optional(),
});

// Helper: mask secret
function maskSecret(secret: string): string {
  if (secret.length <= 8) return '********';
  return secret.substring(0, 8) + '********';
}

// GET /api/webhooks/[id] — Get webhook subscription detail (44.1)
async function handleGetWebhook(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: subscriptionId } = await ctx.params;

    const subscription = await db.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Webhook subscription not found' }, { status: 404 });
    }

    // Only owner can view detail
    if (subscription.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Only owner can view' }, { status: 403 });
    }

    logger.info('webhook_detail_viewed', { subscriptionId }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        ownerId: subscription.ownerId,
        workspaceId: subscription.workspaceId,
        targetUrl: subscription.targetUrl,
        eventTypes: JSON.parse(subscription.eventTypes) as WebhookEventType[],
        secret: maskSecret(subscription.secret),
        isActive: subscription.isActive,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('webhook_detail_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to get webhook detail';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/webhooks/[id] — Update webhook subscription (44.1)
async function handleUpdateWebhook(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: subscriptionId } = await ctx.params;

    const subscription = await db.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Webhook subscription not found' }, { status: 404 });
    }

    if (subscription.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Only owner can update' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateWebhookSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (validated.targetUrl) updateData.targetUrl = validated.targetUrl;
    if (validated.eventTypes) updateData.eventTypes = JSON.stringify(validated.eventTypes);
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.webhookSubscription.update({
      where: { id: subscriptionId },
      data: updateData,
    });

    logger.info('webhook_updated', { subscriptionId, updatedFields: Object.keys(validated) }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        ownerId: updated.ownerId,
        workspaceId: updated.workspaceId,
        targetUrl: updated.targetUrl,
        eventTypes: JSON.parse(updated.eventTypes) as WebhookEventType[],
        secret: maskSecret(updated.secret),
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('webhook_update_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to update webhook';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/webhooks/[id] — Delete webhook subscription (44.1)
async function handleDeleteWebhook(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: subscriptionId } = await ctx.params;

    const subscription = await db.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Webhook subscription not found' }, { status: 404 });
    }

    if (subscription.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Only owner can delete' }, { status: 403 });
    }

    // Delete related deliveries first (cascade should handle this, but be explicit)
    await db.webhookDelivery.deleteMany({
      where: { subscriptionId },
    });

    // Delete the subscription
    await db.webhookSubscription.delete({
      where: { id: subscriptionId },
    });

    logger.info('webhook_deleted', { subscriptionId }, userId);

    return NextResponse.json({ success: true, data: { deleted: true, id: subscriptionId } });
  } catch (error: unknown) {
    logger.error('webhook_delete_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to delete webhook';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleGetWebhook, true);
export const PATCH = traceHandler(handleUpdateWebhook, true);
export const DELETE = traceHandler(handleDeleteWebhook, true);
