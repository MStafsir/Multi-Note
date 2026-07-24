// ============================================================
// MODUL 18.2: Bulk Share API Route
// POST: Share multiple nodes with a single user
// Creates NodeShare entries for all selected nodes
// Includes partial failure handling (18.6)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { createNotification } from '@/lib/notification-sender';
import { z } from 'zod';

const bulkShareSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(100),
  sharedWithUserId: z.string().min(1),
  permissionLevel: z.enum(['view', 'comment', 'edit']),
});

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = bulkShareSchema.parse(body);

    // Verify the target user exists
    const targetUser = await db.user.findUnique({
      where: { id: validated.sharedWithUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 });
    }

    // Can't share with yourself
    if (validated.sharedWithUserId === userId) {
      return NextResponse.json({ success: false, error: 'Cannot share nodes with yourself' }, { status: 400 });
    }

    // Verify all nodes belong to this user and are active
    const nodes = await db.node.findMany({
      where: {
        id: { in: validated.nodeIds },
        ownerId: userId,
        deletedAt: null,
      },
    });

    if (nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid active nodes found' }, { status: 404 });
    }

    // 18.2 — Create NodeShare entries for all selected nodes
    let sharedCount = 0;
    let failedCount = 0;

    for (const node of nodes) {
      try {
        await db.nodeShare.create({
          data: {
            nodeId: node.id,
            sharedWithUserId: validated.sharedWithUserId,
            permissionLevel: validated.permissionLevel,
          },
        });
        sharedCount++;
      } catch (err: unknown) {
        // Skip if share already exists (unique constraint on [nodeId, sharedWithUserId])
        // 18.6 — Partial failure handling: continue with other nodes
        failedCount++;
      }
    }

    // 20 — Send notification for share_received
    await createNotification({
      recipientId: validated.sharedWithUserId,
      type: 'share_received',
      payload: {
        sharedByUserId: userId,
        nodeIds: validated.nodeIds,
        permissionLevel: validated.permissionLevel,
        nodeCount: sharedCount,
      },
    });

    // 19 — Log activity
    await logActivity({
      actorId: userId,
      actionType: 'share',
      metadata: {
        nodeIds: validated.nodeIds,
        sharedWithUserId: validated.sharedWithUserId,
        permissionLevel: validated.permissionLevel,
        bulk: true,
        sharedCount,
        failedCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: { sharedCount, failedCount },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to bulk share nodes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
