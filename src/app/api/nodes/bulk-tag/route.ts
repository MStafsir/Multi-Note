// ============================================================
// MODUL 18.2: Bulk Tag API Route
// POST: Apply a tag to multiple nodes
// Skips if already tagged (unique constraint on [nodeId, tagId])
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';
import { z } from 'zod';

const bulkTagSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(100),
  tagId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = bulkTagSchema.parse(body);

    // Verify the tag exists and belongs to this user
    const tag = await db.tag.findUnique({
      where: { id: validated.tagId },
    });

    if (!tag || tag.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Tag not found or does not belong to you' }, { status: 404 });
    }

    // Verify all nodes belong to this user and are active
    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(userId);
    const nodes = await db.node.findMany({
      where: {
        id: { in: validated.nodeIds },
        ...workspaceScopeFilter,
        deletedAt: null,
      },
    });

    if (nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid active nodes found' }, { status: 404 });
    }

    // 18.2 — Create NodeTag entries for all nodes
    // Skip if already tagged (unique constraint on [nodeId, tagId])
    let taggedCount = 0;
    let skippedCount = 0;

    for (const node of nodes) {
      try {
        await db.nodeTag.create({
          data: {
            nodeId: node.id,
            tagId: validated.tagId,
          },
        });
        taggedCount++;
      } catch (err: unknown) {
        // Unique constraint violation means already tagged — skip
        // 18.6 — Partial failure handling: continue with other nodes
        skippedCount++;
      }
    }

    // 19 — Log activity
    await logActivity({
      actorId: userId,
      actionType: 'edit',
      metadata: {
        nodeIds: validated.nodeIds,
        tagId: validated.tagId,
        tagName: tag.name,
        bulk: true,
        taggedCount,
        skippedCount,
        action: 'bulk_tag',
      },
    });

    return NextResponse.json({
      success: true,
      data: { taggedCount },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to bulk tag nodes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
