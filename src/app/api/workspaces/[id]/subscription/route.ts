// ============================================================
// MODUL 42: Billing & Subscription — Workspace Subscription API
// 42.1 — GET: Get subscription info for workspace (owner/admin only)
// 42.1 — POST: Create/initialize subscription (owner only)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { z } from 'zod';

// 42.1 — Subscription creation schema
const createSubscriptionSchema = z.object({
  provider: z.enum(['stripe', 'midtrans']),
  planTier: z.enum(['free', 'pro', 'enterprise']),
});

// Helper: check if user is owner or admin of workspace
async function checkWorkspaceAccess(userId: string, workspaceId: string, requiredRole: 'owner' | 'owner_or_admin'): Promise<boolean> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) return false;

  if (workspace.ownerId === userId) return true;

  if (requiredRole === 'owner_or_admin') {
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    return membership?.role === 'admin';
  }

  return false;
}

// GET /api/workspaces/[id]/subscription — Get subscription info (42.1)
async function handleGetSubscription(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: workspaceId } = await ctx.params;

    // Owner or admin can view subscription
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId, 'owner_or_admin');
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden — Owner or admin access required' }, { status: 403 });
    }

    const subscription = await db.workspaceSubscription.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return NextResponse.json({ success: true, data: null });
    }

    logger.info('subscription_viewed', { workspaceId, subscriptionId: subscription.id }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        workspaceId: subscription.workspaceId,
        provider: subscription.provider,
        providerCustomerId: subscription.providerCustomerId,
        providerSubscriptionId: subscription.providerSubscriptionId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        gracePeriodEnd: subscription.gracePeriodEnd?.toISOString() ?? null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('subscription_get_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/workspaces/[id]/subscription — Create subscription (42.1)
async function handleCreateSubscription(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: workspaceId } = await ctx.params;

    // Only owner can create subscription
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId, 'owner');
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden — Owner access required' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createSubscriptionSchema.parse(body);

    // Check if subscription already exists for this workspace+provider
    const existing = await db.workspaceSubscription.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: validated.provider } },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Subscription already exists for ${validated.provider}` },
        { status: 409 }
      );
    }

    // Check if trial is available (no previous subscription for this workspace)
    const anySubscription = await db.workspaceSubscription.findFirst({
      where: { workspaceId },
    });

    const initialStatus = anySubscription ? 'active' : 'trialing';

    // Create subscription
    const subscription = await db.workspaceSubscription.create({
      data: {
        workspaceId,
        provider: validated.provider,
        status: initialStatus,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Update workspace planTier
    await db.workspace.update({
      where: { id: workspaceId },
      data: { planTier: validated.planTier },
    });

    logger.info('subscription_created', {
      workspaceId,
      provider: validated.provider,
      planTier: validated.planTier,
      status: initialStatus,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        workspaceId: subscription.workspaceId,
        provider: subscription.provider,
        providerCustomerId: subscription.providerCustomerId,
        providerSubscriptionId: subscription.providerSubscriptionId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        gracePeriodEnd: subscription.gracePeriodEnd?.toISOString() ?? null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('subscription_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create subscription';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleGetSubscription, true);
export const POST = traceHandler(handleCreateSubscription, true);
