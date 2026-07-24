// ============================================================
// MODUL 16.4: Get Specific Note Revision Content
// GET — Return full contentJsonSnapshot for preview on hover
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';

// GET /api/nodes/[id]/revisions/[revisionId] — Get a specific revision's content
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, revisionId } = await params;

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

    // Find the specific revision
    const revision = await db.noteRevision.findUnique({
      where: { id: revisionId },
    });

    if (!revision || revision.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 });
    }

    // Return full contentJsonSnapshot for preview
    return NextResponse.json({
      success: true,
      data: {
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        triggerType: revision.triggerType,
        createdAt: revision.createdAt,
        contentJsonSnapshot: revision.contentJsonSnapshot,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch revision';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
