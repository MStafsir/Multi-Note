// ============================================================
// MODUL 21: Node Tags API Route — Get, Assign, Remove tags on a node
// GET: List tags for a node
// POST: Assign a tag to a node
// DELETE: Remove a tag from a node
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { checkNodeAccess } from '@/lib/permissions';

// --- Zod Validators ---
const assignTagSchema = z.object({
  tagId: z.string().min(1, 'Tag ID is required'),
});

const removeTagSchema = z.object({
  tagId: z.string().min(1, 'Tag ID is required'),
});

// GET /api/nodes/[id]/tags — Get all tags assigned to a node
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

    // Verify node exists and user has view access
    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const viewAccess = await checkNodeAccess(userId, id, 'view');
    if (!viewAccess.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get all tags for this node
    const nodeTags = await db.nodeTag.findMany({
      where: { nodeId: id },
      include: { tag: true },
    });

    return NextResponse.json({
      success: true,
      data: nodeTags.map(nt => ({
        tagId: nt.tagId,
        nodeId: nt.nodeId,
        tag: {
          id: nt.tag.id,
          name: nt.tag.name,
          colorHex: nt.tag.colorHex,
        },
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch node tags';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/nodes/[id]/tags — Assign a tag to a node
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
    const validated = assignTagSchema.parse(body);

    // Verify node exists and user has edit access
    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const editAccess = await checkNodeAccess(userId, id, 'edit');
    if (!editAccess.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Verify tag exists and belongs to user
    const tag = await db.tag.findUnique({ where: { id: validated.tagId } });
    if (!tag || tag.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Tag not found or does not belong to you' }, { status: 404 });
    }

    // Create NodeTag entry (skip if already exists)
    try {
      await db.nodeTag.create({
        data: {
          nodeId: id,
          tagId: validated.tagId,
        },
      });
    } catch {
      // Unique constraint violation — tag already assigned
      return NextResponse.json(
        { success: false, error: 'Tag already assigned to this node' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tagId: validated.tagId,
        nodeId: id,
        tag: {
          id: tag.id,
          name: tag.name,
          colorHex: tag.colorHex,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to assign tag';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// DELETE /api/nodes/[id]/tags — Remove a tag from a node
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get tagId from query params for DELETE
    const { searchParams } = new URL(request.url);
    let tagId = searchParams.get('tagId');

    if (!tagId) {
      // Also support body-based tagId
      const body = await request.json().catch(() => ({}));
      const validated = removeTagSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json({ success: false, error: 'Tag ID is required (pass as query param tagId or in body)' }, { status: 400 });
      }
      tagId = validated.data.tagId;
    }

    // Verify node exists and user has edit access
    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const editAccess = await checkNodeAccess(userId, id, 'edit');
    if (!editAccess.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Delete NodeTag entry
    try {
      await db.nodeTag.delete({
        where: {
          nodeId_tagId: { nodeId: id, tagId },
        },
      });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tag not assigned to this node' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { tagId, nodeId: id },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove tag';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
