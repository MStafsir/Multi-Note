// ============================================================
// MODUL 34.3: Backlinks API — GET backlinks for a note
// Returns array of BacklinkInfo (source node name, context snippet, created_at)
// Also marks broken links (target deleted or access revoked)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { getBacklinkContextSnippets } from '@/lib/update-note-links';

// GET /api/nodes/[id]/backlinks — Get all notes that reference this note
async function handleGetBacklinks(
  request: Request,
  context: unknown
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    // Check if the target node exists and user has access
    const node = await db.node.findUnique({
      where: { id },
      select: { id: true, ownerId: true, deletedAt: true, type: true },
    });

    if (!node) {
      logger.info('backlinks_node_not_found', { nodeId: id }, session.user.id);
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Check access: owner or share access
    const accessResult = await checkNodeAccess(session.user.id, id, 'view');
    if (!accessResult.hasAccess) {
      logger.warn('backlinks_access_denied', { nodeId: id }, session.user.id);
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get backlinks with context snippets
    const backlinks = await getBacklinkContextSnippets(id, session.user.id);

    // For each backlink, check if the source node is accessible to the user
    // (if not owner and no share, mark as "access revoked")
    const enrichedBacklinks = await Promise.all(
      backlinks.map(async (bl) => {
        const sourceAccess = await checkNodeAccess(session.user.id, bl.sourceNodeId, 'view');
        const accessRevoked = !sourceAccess.hasAccess && !bl.isBroken;

        return {
          ...bl,
          accessRevoked,
        };
      })
    );

    logger.info('backlinks_fetched', {
      nodeId: id,
      count: enrichedBacklinks.length,
    }, session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        backlinks: enrichedBacklinks,
        total: enrichedBacklinks.length,
      },
    });
  } catch (error: unknown) {
    logger.error('backlinks_fetch_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch backlinks';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleGetBacklinks, true);
