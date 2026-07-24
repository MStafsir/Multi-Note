// ============================================================
// MODUL 44: Webhook Delivery Audit Trail
// GET: List delivery attempts for this webhook subscription
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import type { WebhookDeliveryStatus } from '@/types';

// GET /api/webhooks/[id]/deliveries — List delivery attempts (44.2 audit trail)
async function handleListDeliveries(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: subscriptionId } = await ctx.params;

    // Verify subscription exists and user owns it
    const subscription = await db.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Webhook subscription not found' }, { status: 404 });
    }

    if (subscription.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Only owner can view deliveries' }, { status: 403 });
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Optional status filter
    const statusFilter = searchParams.get('status') as WebhookDeliveryStatus | null;

    const where: Record<string, unknown> = { subscriptionId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const deliveries = await db.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.webhookDelivery.count({ where });

    logger.info('webhook_deliveries_listed', { subscriptionId, count: deliveries.length, total }, userId);

    return NextResponse.json({
      success: true,
      data: {
        deliveries: deliveries.map(d => ({
          id: d.id,
          subscriptionId: d.subscriptionId,
          eventType: d.eventType,
          payload: d.payload,
          responseStatus: d.responseStatus,
          responseBody: d.responseBody,
          attemptCount: d.attemptCount,
          nextAttemptAt: d.nextAttemptAt?.toISOString() ?? null,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + deliveries.length < total,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('webhook_deliveries_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list deliveries';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleListDeliveries, true);
