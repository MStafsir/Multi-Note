// ============================================================
// MODUL 18.3: Bulk Delete API Route
// POST: Soft-delete multiple nodes and their descendants
// Uses updateMany for batch operation (not loop per node)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { getAllDescendants } from '@/lib/permissions';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = bulkDeleteSchema.parse(body);

    // Verify all nodes belong to this user and are not already trashed
    const nodes = await db.node.findMany({
      where: {
        id: { in: validated.nodeIds },
        ownerId: userId,
      },
    });

    if (nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid nodes found' }, { status: 404 });
    }

    // Already-trashed nodes should not be re-trashed
    const activeNodes = nodes.filter((n) => n.deletedAt === null);
    if (activeNodes.length === 0) {
      return NextResponse.json({ success: false, error: 'All selected nodes are already in trash' }, { status: 400 });
    }

    const now = new Date();

    // Collect all IDs including descendants of folders
    const allIdsToSoftDelete: string[] = [];

    for (const node of activeNodes) {
      allIdsToSoftDelete.push(node.id);

      // For folders, also soft-delete all descendants
      if (node.type === 'folder') {
        const descendantIds = await getAllDescendants(node.id);
        allIdsToSoftDelete.push(...descendantIds);
      }
    }

    // Deduplicate IDs (in case some nodes share descendants)
    const uniqueIds = [...new Set(allIdsToSoftDelete)];

    // 18.3 — Single batch UPDATE using updateMany
    const result = await db.node.updateMany({
      where: {
        id: { in: uniqueIds },
        ownerId: userId,
        deletedAt: null, // Only soft-delete active nodes (not already trashed)
      },
      data: { deletedAt: now },
    });

    // 19 — Log activity
    await logActivity({
      actorId: userId,
      actionType: 'delete',
      metadata: { nodeIds: validated.nodeIds, bulk: true, totalSoftDeleted: result.count },
    });

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.count },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to bulk delete nodes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
