// ============================================================
// MODUL 44: Webhook Subscriptions — List & Create
// 44.1 — GET: List user's webhook subscriptions
// 44.1 — POST: Create webhook subscription
//   Validate with Zod: { targetUrl, eventTypes, workspaceId }
//   Generate random secret for HMAC-SHA256 signing
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';
import { z } from 'zod';
import crypto from 'crypto';
import type { WebhookEventType } from '@/types';

// 44.1 — Create webhook subscription schema
const createWebhookSubscriptionSchema = z.object({
  targetUrl: z.string().url('Must be a valid URL'),
  eventTypes: z.array(z.enum(['node.created', 'node.deleted', 'note.updated', 'file.uploaded'])).min(1, 'At least one event type required'),
  workspaceId: z.string().optional(),
});

// GET /api/webhooks — List user's webhook subscriptions (44.1)
async function handleListWebhooks(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(userId);

    const subscriptions = await db.webhookSubscription.findMany({
      where: { ...workspaceScopeFilter },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('webhooks_listed', { count: subscriptions.length }, userId);

    return NextResponse.json({
      success: true,
      data: subscriptions.map(sub => ({
        id: sub.id,
        ownerId: sub.ownerId,
        workspaceId: sub.workspaceId,
        targetUrl: sub.targetUrl,
        eventTypes: JSON.parse(sub.eventTypes) as WebhookEventType[],
        secret: maskSecret(sub.secret), // Mask secret in list view
        isActive: sub.isActive,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    logger.error('webhooks_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list webhooks';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/webhooks — Create webhook subscription (44.1)
async function handleCreateWebhook(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createWebhookSubscriptionSchema.parse(body);

    // If workspaceId provided, verify user has access
    if (validated.workspaceId) {
      const membership = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: validated.workspaceId, userId } },
        select: { role: true },
      });

      const workspace = await db.workspace.findUnique({
        where: { id: validated.workspaceId },
        select: { ownerId: true },
      });

      if (!workspace || (workspace.ownerId !== userId && !membership)) {
        return NextResponse.json({ success: false, error: 'No access to this workspace' }, { status: 403 });
      }

      // Only owner/admin can create workspace-level webhooks
      if (workspace.ownerId !== userId && membership?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Only workspace owner or admin can create workspace webhooks' }, { status: 403 });
      }
    }

    // Generate random secret for HMAC-SHA256 signing (44.3)
    const secret = crypto.randomBytes(32).toString('hex');

    const subscription = await db.webhookSubscription.create({
      data: {
        ownerId: userId,
        workspaceId: validated.workspaceId || null,
        targetUrl: validated.targetUrl,
        eventTypes: JSON.stringify(validated.eventTypes),
        secret,
        isActive: true,
      },
    });

    logger.info('webhook_created', {
      subscriptionId: subscription.id,
      targetUrl: validated.targetUrl,
      eventTypes: validated.eventTypes,
      workspaceId: validated.workspaceId || null,
    }, userId);

    // Return secret in full — only shown once at creation (similar to API keys)
    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        ownerId: subscription.ownerId,
        workspaceId: subscription.workspaceId,
        targetUrl: subscription.targetUrl,
        eventTypes: JSON.parse(subscription.eventTypes) as WebhookEventType[],
        secret, // Full secret shown only at creation
        isActive: subscription.isActive,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('webhook_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create webhook';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Helper: Mask secret for display (show first 8 chars + asterisks)
function maskSecret(secret: string): string {
  if (secret.length <= 8) return '********';
  return secret.substring(0, 8) + '********';
}

export const GET = traceHandler(handleListWebhooks);
export const POST = traceHandler(handleCreateWebhook);
