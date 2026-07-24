// ============================================================
// MODUL 16.5: Restore Note Revision (Non-destructive)
// POST — Restore a revision without overwriting current state
// First saves current content as new revision, then updates
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { checkNodeAccess } from '@/lib/permissions';
import { z } from 'zod';

// Zod validation for restore request body
const restoreRevisionSchema = z.object({
  revisionId: z.string().min(1, 'Revision ID is required'),
});

// POST /api/nodes/[id]/revisions/restore — Restore a revision (non-destructive)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = restoreRevisionSchema.parse(body);

    // Check node exists
    const node = await db.node.findUnique({
      where: { id },
      include: { note: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'note') {
      return NextResponse.json({ success: false, error: 'Node is not a note' }, { status: 400 });
    }

    // Check user has edit access (owner OR edit-level share)
    const accessResult = await checkNodeAccess(userId, id, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'You need edit permission to restore this note' }, { status: 403 });
    }

    // Find the target revision to restore
    const targetRevision = await db.noteRevision.findUnique({
      where: { id: validated.revisionId },
    });

    if (!targetRevision || targetRevision.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 });
    }

    // Step 1: Save current content as a new revision (preserving current state)
    if (node.note?.contentJson) {
      const latestRevision = await db.noteRevision.findFirst({
        where: { nodeId: id },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });

      const newRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

      await db.noteRevision.create({
        data: {
          nodeId: id,
          contentJsonSnapshot: node.note.contentJson,
          revisionNumber: newRevisionNumber,
          triggerType: 'restore', // Mark this as created by a restore action
        },
      });
    }

    // Step 2: Update NoteContent.contentJson with the selected revision's contentJsonSnapshot
    await db.noteContent.upsert({
      where: { nodeId: id },
      update: { contentJson: targetRevision.contentJsonSnapshot },
      create: { nodeId: id, contentJson: targetRevision.contentJsonSnapshot },
    });

    // Update node updatedAt
    await db.node.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId: id,
      actionType: 'restore',
      metadata: {
        revisionId: validated.revisionId,
        revisionNumber: targetRevision.revisionNumber,
        triggerType: targetRevision.triggerType,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        restoredRevision: {
          id: targetRevision.id,
          revisionNumber: targetRevision.revisionNumber,
          triggerType: targetRevision.triggerType,
          createdAt: targetRevision.createdAt,
        },
        noteId: id,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to restore revision';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
