// ============================================================
// MODUL 4: Node CRUD API Routes — Rename, Delete, Move
// MODUL 27: Added traceHandler wrapper & structured logging
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { renameNodeSchema, deleteNodeSchema, moveNodeSchema, noteContentSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';
import { checkNodeAccess, getAllDescendants } from '@/lib/permissions';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';

// GET /api/nodes/[id] — Get single node details
async function handleGetNode(
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

    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true, note: true },
    });

    if (!node) {
      logger.info('node_not_found', { nodeId: id }, session.user.id);
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Modul 13 — Permission check: owner OR share access (view/comment/edit)
    const accessResult = await checkNodeAccess(session.user.id, id, 'view');
    if (!accessResult.hasAccess) {
      logger.warn('node_access_denied', { nodeId: id, action: 'view' }, session.user.id);
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
    logger.error('node_get_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch node';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/nodes/[id] — Rename or Move node (4.2, 4.4)
async function handlePatchNode(
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
    const body = await request.json();

    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      logger.info('node_not_found', { nodeId: id, action: 'patch' }, session.user.id);
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Modul 13 — Permission check: owner OR workspace member OR edit-level share
    const editAccess = await checkNodeAccess(session.user.id, id, 'edit');

    // 4.2 — Rename (edit access required)
    if (body.newName) {
      if (!editAccess.hasAccess) {
        logger.warn('node_rename_denied', { nodeId: id, reason: 'no_edit_access' }, session.user.id);
        return NextResponse.json({ success: false, error: 'You need edit permission to rename this node' }, { status: 403 });
      }
      const validated = renameNodeSchema.parse({ nodeId: id, newName: body.newName });

      // Check duplicate name in same parent scope
      const duplicate = await db.node.findFirst({
        where: {
          ownerId: session.user.id,
          workspaceId: node.workspaceId,
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

      logger.info('node_renamed', { nodeId: id, newName: validated.newName }, session.user.id);

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

    // 4.4 — Move (edit access required)
    if (body.newParentId !== undefined) {
      if (!editAccess.hasAccess) {
        logger.warn('node_move_denied', { nodeId: id, reason: 'no_edit_access' }, session.user.id);
        return NextResponse.json({ success: false, error: 'You need edit permission to move this node' }, { status: 403 });
      }

      const validated = moveNodeSchema.parse({ nodeId: id, newParentId: body.newParentId });

      // 4.4 — Cycle detection: folder cannot be moved into its own child
      if (validated.newParentId) {
        const isDescendant = await checkDescendant(id, validated.newParentId, session.user.id, node.workspaceId);
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

      logger.info('node_moved', { nodeId: id, newParentId: validated.newParentId }, session.user.id);

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
        logger.warn('note_edit_denied', { nodeId: id, reason: 'no_edit_access' }, session.user.id);
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

      logger.info('note_content_updated', { nodeId: id }, session.user.id);

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
    logger.error('node_patch_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to update node';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// DELETE /api/nodes/[id] — Soft-delete with cascade (4.3)
async function handleDeleteNode(
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

    const node = await db.node.findUnique({ where: { id } });
    if (!node) {
      logger.info('node_delete_not_found', { nodeId: id }, session.user.id);
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const deleteAccess = await checkNodeAccess(session.user.id, id, 'edit');
    if (!deleteAccess.hasAccess) {
      logger.warn('node_delete_denied', { nodeId: id }, session.user.id);
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const now = new Date();

    // 4.3 — Soft-delete cascading: set deleted_at on node and all children
    // Recursive CTE equivalent for SQLite: get all descendant IDs
    const descendantIds = await getAllDescendants(id, session.user.id, node.workspaceId);
    const allIds = [id, ...descendantIds];

    // Batch update — single statement, not loop per-node
    await db.node.updateMany({
      where: {
        id: { in: allIds },
        ownerId: session.user.id,
        workspaceId: node.workspaceId ?? undefined,
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

    logger.info('node_deleted', { nodeId: id, type: node.type, name: node.name, childCount: descendantIds.length }, session.user.id);

    return NextResponse.json({
      success: true,
      data: { deletedCount: allIds.length },
    });
  } catch (error: unknown) {
    logger.error('node_delete_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to delete node';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 4.4 — Cycle detection: recursive ancestor lookup
async function checkDescendant(nodeId: string, targetParentId: string, sessionUserId: string, workspaceId?: string): Promise<boolean> {
  // Check if targetParentId is a descendant of nodeId
  const descendants = await getAllDescendants(nodeId, sessionUserId, workspaceId);
  return descendants.includes(targetParentId);
}


export const GET = traceHandler(handleGetNode, true);
export const PATCH = traceHandler(handlePatchNode, true);
export const DELETE = traceHandler(handleDeleteNode, true);
