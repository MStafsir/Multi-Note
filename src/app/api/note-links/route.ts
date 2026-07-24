// ============================================================
// MODUL 34.4: Note Links Update API — POST endpoint
// Allows client to trigger updateNoteLinks after saving note content
// This bridges the gap since the existing PATCH /api/nodes/[id] route
// doesn't call updateNoteLinks (requires integration step)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { updateNoteLinks } from '@/lib/update-note-links';

// POST /api/note-links — Trigger note link extraction/update for a specific note
// Body: { nodeId: string, contentJson?: string }
// Called by client after saving note content to update the note_links table
async function handlePostNoteLinks(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { nodeId, contentJson } = body;

    if (!nodeId || typeof nodeId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'nodeId is required and must be a string' },
        { status: 400 }
      );
    }

    // Verify the node exists and is a note
    const node = await db.node.findUnique({
      where: { id: nodeId },
      select: { id: true, type: true, ownerId: true, deletedAt: true },
    });

    if (!node) {
      logger.info('note_links_node_not_found', { nodeId }, userId);
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.deletedAt) {
      logger.info('note_links_node_deleted', { nodeId }, userId);
      return NextResponse.json({ success: false, error: 'Node has been deleted' }, { status: 400 });
    }

    if (node.type !== 'note') {
      logger.info('note_links_not_a_note', { nodeId, type: node.type }, userId);
      return NextResponse.json({ success: false, error: 'Node is not a note' }, { status: 400 });
    }

    // Check edit access — only users who can edit the note should update its links
    const accessResult = await checkNodeAccess(userId, nodeId, 'edit');
    if (!accessResult.hasAccess) {
      logger.warn('note_links_access_denied', { nodeId }, userId);
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get the note's contentJson from the database if not provided in the request body
    let content = contentJson;
    if (!content || typeof content !== 'string') {
      const noteContent = await db.noteContent.findUnique({
        where: { nodeId },
        select: { contentJson: true },
      });

      if (!noteContent?.contentJson) {
        // No content yet — clear all existing links for this source
        await db.noteLink.deleteMany({ where: { sourceNodeId: nodeId } });
        logger.info('note_links_no_content', { nodeId }, userId);
        return NextResponse.json({
          success: true,
          data: { nodeId, linkCount: 0, message: 'No content — all existing links cleared' },
        });
      }

      content = noteContent.contentJson;
    }

    // Execute the link extraction and update
    await updateNoteLinks(nodeId, content, userId);

    // Count the new links
    const linkCount = await db.noteLink.count({
      where: { sourceNodeId: nodeId },
    });

    logger.info('note_links_updated_via_api', { nodeId, linkCount }, userId);

    return NextResponse.json({
      success: true,
      data: {
        nodeId,
        linkCount,
        message: `Updated ${linkCount} note link(s)`,
      },
    });
  } catch (error: unknown) {
    logger.error('note_links_update_api_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to update note links';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const POST = traceHandler(handlePostNoteLinks);
