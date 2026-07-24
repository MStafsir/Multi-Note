// ============================================================
// MODUL 4: Node CRUD API Routes — Rename, Delete, Move
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { renameNodeSchema, deleteNodeSchema, moveNodeSchema, noteContentSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';
import { checkNodeAccess } from '@/lib/permissions';
import { logActivity } from '@/lib/activity-logger';

// GET /api/nodes/[id] — Get single node details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true, note: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Modul 13 — Permission check: owner OR share access (view/comment/edit)
    const accessResult = await checkNodeAccess(session.user.id, id, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const metadata = node.metadata as Record<string, unknown> | null;
    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        deletedAt: node.deletedAt,
        metadata: metadata ? { ...metadata, sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null) } : null,
        content: node.note ? { nodeId: node.note.nodeId, contentJson: node.note.contentJson } : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch node';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/nodes/[id] — Rename or Move node (4.2, 4.4)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Modul 13 — For rename/move, only owner can perform these actions
    // For note content editing, owner OR user with 'edit' share can modify
    const isOwner = node.ownerId === session.user.id;
    const editAccess = await checkNodeAccess(session.user.id, id, 'edit');

    // 4.2 — Rename (owner only)
    if (body.newName) {
      if (!isOwner) {
        return NextResponse.json({ success: false, error: 'Only the owner can rename this node' }, { status: 403 });
      }
      const validated = renameNodeSchema.parse({ nodeId: id, newName: body.newName });

      // Check duplicate name in same parent scope
      const duplicate = await db.node.findFirst({
        where: {
          ownerId: session.user.id,
          parentId: node.parentId,
          name: validated.newName,
          type: node.type,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Name already exists in this location' },
          { status: 409 }
        );
      }

      const updated = await db.node.update({
        where: { id },
        data: { name: validated.newName },
        include: { metadata: true, note: true },
      });

      await logActivity({ actorId: session.user.id, nodeId: id, actionType: 'rename', metadata: { oldName: node.name, newName: validated.newName } });

      const renameMetadata = updated.metadata as Record<string, unknown> | null;
      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          type: updated.type,
          name: updated.name,
          parentId: updated.parentId,
          ownerId: updated.ownerId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          deletedAt: updated.deletedAt,
          metadata: renameMetadata ? { ...renameMetadata, sizeBytes: bigintToNumber(renameMetadata.sizeBytes as bigint | number | null) } : null,
          content: updated.note ? { nodeId: updated.note.nodeId, contentJson: updated.note.contentJson } : null,
        },
      });
    }

    // 4.4 — Move (owner only)
    if (body.newParentId !== undefined) {
      if (!isOwner) {
        return NextResponse.json({ success: false, error: 'Only the owner can move this node' }, { status: 403 });
      }

      const validated = moveNodeSchema.parse({ nodeId: id, newParentId: body.newParentId });

      // 4.4 — Cycle detection: folder cannot be moved into its own child
      if (validated.newParentId) {
        const isDescendant = await checkDescendant(id, validated.newParentId);
        if (isDescendant) {
          return NextResponse.json(
            { success: false, error: 'Cannot move a folder into its own descendant' },
            { status: 400 }
          );
        }
      }

      const updated = await db.node.update({
        where: { id },
        data: { parentId: validated.newParentId || null },
        include: { metadata: true, note: true },
      });

      await logActivity({ actorId: session.user.id, nodeId: id, actionType: 'move', metadata: {
        oldParentId: node.parentId,
        newParentId: validated.newParentId,
      } });

      const moveMetadata = updated.metadata as Record<string, unknown> | null;
      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          type: updated.type,
          name: updated.name,
          parentId: updated.parentId,
          ownerId: updated.ownerId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          deletedAt: updated.deletedAt,
          metadata: moveMetadata ? { ...moveMetadata, sizeBytes: bigintToNumber(moveMetadata.sizeBytes as bigint | number | null) } : null,
          content: updated.note ? { nodeId: updated.note.nodeId, contentJson: updated.note.contentJson } : null,
        },
      });
    }

    // Note content update (owner OR edit share)
    if (body.contentJson !== undefined && node.type === 'note') {
      if (!editAccess.hasAccess) {
        return NextResponse.json({ success: false, error: 'You need edit permission to modify this note' }, { status: 403 });
      }

      const validated = noteContentSchema.parse({ nodeId: id, contentJson: body.contentJson });

      // Upsert note content
      await db.noteContent.upsert({
        where: { nodeId: id },
        update: { contentJson: validated.contentJson },
        create: { nodeId: id, contentJson: validated.contentJson },
      });

      const updated = await db.node.update({
        where: { id },
        data: { updatedAt: new Date() },
        include: { metadata: true, note: true },
      });

      await logActivity({ actorId: session.user.id, nodeId: id, actionType: 'edit', metadata: { type: 'note' } });

      const noteMetadata = updated.metadata as Record<string, unknown> | null;
      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          type: updated.type,
          name: updated.name,
          parentId: updated.parentId,
          ownerId: updated.ownerId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          deletedAt: updated.deletedAt,
          metadata: noteMetadata ? { ...noteMetadata, sizeBytes: bigintToNumber(noteMetadata.sizeBytes as bigint | number | null) } : null,
          content: updated.note ? { nodeId: updated.note.nodeId, contentJson: updated.note.contentJson } : null,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'No action specified' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update node';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// DELETE /api/nodes/[id] — Soft-delete with cascade (4.3)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const node = await db.node.findUnique({ where: { id } });
    if (!node || node.ownerId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const now = new Date();

    // 4.3 — Soft-delete cascading: set deleted_at on node and all children
    // Recursive CTE equivalent for SQLite: get all descendant IDs
    const descendantIds = await getAllDescendants(id);
    const allIds = [id, ...descendantIds];

    // Batch update — single statement, not loop per-node
    await db.node.updateMany({
      where: {
        id: { in: allIds },
        ownerId: session.user.id,
      },
      data: { deletedAt: now },
    });

    // Update storage used if deleting files
    const fileNodes = await db.node.findMany({
      where: { id: { in: allIds }, type: 'file' },
      include: { metadata: true },
    });

    let totalBytesFreed = 0;
    for (const f of fileNodes) {
      if (f.metadata) {
        totalBytesFreed += bigintToNumber(f.metadata.sizeBytes) ?? 0;
      }
    }

    if (totalBytesFreed > 0) {
      await db.profile.update({
        where: { userId: session.user.id },
        data: { storageUsedBytes: { decrement: totalBytesFreed } },
      });
    }

    await logActivity({ actorId: session.user.id, nodeId: id, actionType: 'delete', metadata: { type: node.type, name: node.name, childCount: descendantIds.length } });

    return NextResponse.json({
      success: true,
      data: { deletedCount: allIds.length },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete node';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 4.4 — Cycle detection: recursive ancestor lookup
async function checkDescendant(nodeId: string, targetParentId: string): boolean {
  // Check if targetParentId is a descendant of nodeId
  const descendants = await getAllDescendants(nodeId);
  return descendants.includes(targetParentId);
}

// Get all descendant IDs recursively (SQLite doesn't support recursive CTE in Prisma)
async function getAllDescendants(parentId: string): string[] {
  const descendants: string[] = [];
  let currentIds = [parentId];

  while (currentIds.length > 0) {
    const children = await db.node.findMany({
      where: { parentId: { in: currentIds } },
      select: { id: true },
    });
    currentIds = children.map(c => c.id);
    descendants.push(...currentIds);
  }

  return descendants;
}


