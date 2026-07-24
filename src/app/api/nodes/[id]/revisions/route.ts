// ============================================================
// MODUL 16: Note Revision History API Routes
// GET — List all revisions for a note node (sorted desc)
// POST — Create a revision snapshot (for autosave/manual intervals)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { logActivity } from '@/lib/activity-logger';
import { z } from 'zod';

// Zod validation for create revision request body
const createRevisionSchema = z.object({
  contentJson: z.string().min(1, 'Content JSON is required'),
  triggerType: z.enum(['autosave', 'manual', 'restore']).default('autosave'),
});

// GET /api/nodes/[id]/revisions — List all revisions for a note node
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check node exists
    const node = await db.node.findUnique({
      where: { id },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'note') {
      return NextResponse.json({ success: false, error: 'Node is not a note' }, { status: 400 });
    }

    // Check user owns or has access to the note
    const accessResult = await checkNodeAccess(userId, id, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Fetch revisions sorted by revisionNumber desc — metadata only (not full contentJsonSnapshot)
    const revisions = await db.noteRevision.findMany({
      where: { nodeId: id },
      orderBy: { revisionNumber: 'desc' },
      select: {
        id: true,
        revisionNumber: true,
        triggerType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        revisions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch revisions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/nodes/[id]/revisions — Create a revision snapshot (16.2)
// Called by useNoteRevisions hook at interval thresholds
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
    const validated = createRevisionSchema.parse(body);

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
      return NextResponse.json({ success: false, error: 'Edit access required to create revisions' }, { status: 403 });
    }

    // Prevent duplicate revisions — check if the current content already has a revision
    // Compare with the latest revision's contentJsonSnapshot
    const latestRevision = await db.noteRevision.findFirst({
      where: { nodeId: id },
      orderBy: { revisionNumber: 'desc' },
      select: {
        id: true,
        contentJsonSnapshot: true,
        revisionNumber: true,
      },
    });

    // Skip if content is identical to latest revision (avoid bloat)
    if (latestRevision && latestRevision.contentJsonSnapshot === validated.contentJson) {
      return NextResponse.json({
        success: true,
        data: {
          id: latestRevision.id,
          revisionNumber: latestRevision.revisionNumber,
          triggerType: validated.triggerType,
          createdAt: latestRevision.createdAt,
          skipped: true, // Flag to indicate no new revision was created
        },
      });
    }

    // Get next revision number
    const nextRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

    // Create new revision
    const newRevision = await db.noteRevision.create({
      data: {
        nodeId: id,
        contentJsonSnapshot: validated.contentJson,
        revisionNumber: nextRevisionNumber,
        triggerType: validated.triggerType,
      },
    });

    // Log activity (only for manual/restore — not autosave to reduce noise)
    if (validated.triggerType !== 'autosave') {
      await logActivity({
        actorId: userId,
        nodeId: id,
        actionType: 'edit',
        metadata: { revisionId: newRevision.id, revisionNumber: nextRevisionNumber, triggerType: validated.triggerType },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newRevision.id,
        revisionNumber: newRevision.revisionNumber,
        triggerType: newRevision.triggerType,
        createdAt: newRevision.createdAt,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to create revision';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
