// ============================================================
// MODUL 21: Favorite Toggle API Route — Toggle isFavorite on a node
// MODUL 27: Added traceHandler wrapper & structured logging
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { checkNodeAccess } from '@/lib/permissions';

// PATCH /api/nodes/[id]/favorite — Toggle favorite on a node
async function handleToggleFavorite(
  request: Request,
  context: unknown
): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;
    const body = await request.json();

    // Verify node exists
    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      logger.info('favorite_node_not_found', { nodeId: id }, userId);
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Verify edit access (owner OR workspace member OR edit-level share)
    const accessResult = await checkNodeAccess(userId, id, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Determine the new favorite state
    // If body.isFavorite is provided, use it; otherwise toggle current state
    const newFavoriteState = typeof body.isFavorite === 'boolean'
      ? body.isFavorite
      : !node.isFavorite;

    const updated = await db.node.update({
      where: { id },
      data: { isFavorite: newFavoriteState },
    });

    logger.info('favorite_toggled', { nodeId: id, isFavorite: newFavoriteState }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        isFavorite: updated.isFavorite,
      },
    });
  } catch (error: unknown) {
    logger.error('favorite_toggle_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to toggle favorite';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const PATCH = traceHandler(handleToggleFavorite, true);
