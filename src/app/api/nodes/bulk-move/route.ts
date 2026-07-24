// ============================================================
// MODUL 18.2: Bulk Move API Route
// POST: Move multiple nodes to a target folder
// Includes cycle detection — target can't be descendant of any moved node
// Uses updateMany for batch operation
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { getAllDescendants } from '@/lib/permissions';
import { z } from 'zod';

const bulkMoveSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(100),
  targetFolderId: z.string().nullable(),
});

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = bulkMoveSchema.parse(body);

    // Verify all nodes belong to this user
    const nodes = await db.node.findMany({
      where: {
        id: { in: validated.nodeIds },
        ownerId: userId,
        deletedAt: null, // Only move active nodes
      },
    });

    if (nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid active nodes found' }, { status: 404 });
    }

    // Validate target folder if specified
    if (validated.targetFolderId) {
      const targetFolder = await db.node.findUnique({
        where: { id: validated.targetFolderId },
      });

      if (!targetFolder || targetFolder.ownerId !== userId || targetFolder.type !== 'folder') {
        return NextResponse.json({ success: false, error: 'Target folder not found or invalid' }, { status: 404 });
      }

      if (targetFolder.deletedAt !== null) {
        return NextResponse.json({ success: false, error: 'Target folder is in trash' }, { status: 400 });
      }

      // 18.2 — Cycle detection: target can't be descendant of any moved node
      for (const node of nodes) {
        if (node.type === 'folder') {
          const descendants = await getAllDescendants(node.id);
          if (descendants.includes(validated.targetFolderId)) {
            return NextResponse.json(
              { success: false, error: `Cannot move "${node.name}" — target folder is inside it` },
              { status: 400 }
            );
          }
        }

        // Can't move a node into itself
        if (node.id === validated.targetFolderId) {
          return NextResponse.json(
            { success: false, error: `Cannot move "${node.name}" into itself` },
            { status: 400 }
          );
        }
      }
    }

    // 18.2 — Batch update: set parentId for all selected nodes
    const result = await db.node.updateMany({
      where: {
        id: { in: validated.nodeIds },
        ownerId: userId,
        deletedAt: null,
      },
      data: { parentId: validated.targetFolderId },
    });

    // 19 — Log activity
    await logActivity({
      actorId: userId,
      actionType: 'move',
      metadata: {
        nodeIds: validated.nodeIds,
        targetFolderId: validated.targetFolderId,
        bulk: true,
        movedCount: result.count,
      },
    });

    return NextResponse.json({
      success: true,
      data: { movedCount: result.count },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to bulk move nodes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
