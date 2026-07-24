// ============================================================
// MODUL 42.4: Invoice History API — List invoices for workspace
// Owner-only access, sorted by createdAt desc
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';

// GET /api/workspaces/[id]/invoices — List invoices (42.4)
async function handleGetInvoices(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: workspaceId } = await ctx.params;

    // Only owner can view invoices (42.4)
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Owner access required' }, { status: 403 });
    }

    // Get invoices sorted by createdAt desc, include subscription info
    const invoices = await db.invoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          select: {
            id: true,
            provider: true,
            status: true,
          },
        },
      },
    });

    logger.info('invoices_listed', { workspaceId, count: invoices.length }, userId);

    return NextResponse.json({
      success: true,
      data: invoices.map(inv => ({
        id: inv.id,
        subscriptionId: inv.subscriptionId,
        workspaceId: inv.workspaceId,
        providerInvoiceId: inv.providerInvoiceId,
        amount: bigintToNumber(inv.amount),
        currency: inv.currency,
        status: inv.status,
        paidAt: inv.paidAt?.toISOString() ?? null,
        dueDate: inv.dueDate?.toISOString() ?? null,
        pdfUrl: inv.pdfUrl,
        createdAt: inv.createdAt.toISOString(),
        subscription: {
          id: inv.subscription.id,
          provider: inv.subscription.provider,
          status: inv.subscription.status,
        },
      })),
    });
  } catch (error: unknown) {
    logger.error('invoices_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list invoices';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleGetInvoices, true);
