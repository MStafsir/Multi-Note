// ============================================================
// MODUL 17.2: Trash Restore API Route
// POST: Restore a node and its descendants from trash
// Includes quota check (17.5) and parent validity check
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { bigintToNumber } from '@/lib/bigint';
import { getAllDescendants } from '@/lib/permissions';
import { z } from 'zod';

const restoreSchema = z.object({
  nodeId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = restoreSchema.parse(body);

    // Find the trashed node
    const node = await db.node.findUnique({
      where: { id: validated.nodeId },
    });

    if (!node || node.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Node not found in trash' }, { status: 404 });
    }

    if (node.deletedAt === null) {
      return NextResponse.json({ success: false, error: 'Node is not in trash' }, { status: 400 });
    }

    // 17.2 — Get all descendants that were also soft-deleted
    const descendantIds = await getAllDescendants(validated.nodeId);

    // Collect all IDs to restore (node itself + descendants)
    const allIds = [validated.nodeId, ...descendantIds];

    // 17.5 — QUOTA CHECK: Calculate total size of files being restored
    const fileNodes = await db.node.findMany({
      where: { id: { in: allIds }, type: 'file' },
      include: { metadata: true },
    });

    let totalRestoredBytes = 0;
    for (const f of fileNodes) {
      if (f.metadata) {
        totalRestoredBytes += bigintToNumber(f.metadata.sizeBytes) ?? 0;
      }
    }

    // Check quota — get current usage
    const profile = await db.profile.findUnique({ where: { userId } });
    const currentUsedBytes = profile ? bigintToNumber(profile.storageUsedBytes) ?? 0 : 0;
    const quotaLimitBytes = profile ? bigintToNumber(profile.quotaLimitBytes) ?? 5368709120 : 5368709120;

    if (currentUsedBytes + totalRestoredBytes > quotaLimitBytes) {
      return NextResponse.json(
        { success: false, error: 'Restore would exceed storage quota' },
        { status: 403 }
      );
    }

    // 17.2 — Check if original parent still exists (not deleted or permanently removed)
    let warning: string | null = null;
    if (node.parentId) {
      const parent = await db.node.findUnique({
        where: { id: node.parentId },
      });

      if (!parent || parent.deletedAt !== null) {
        // Parent was permanently deleted or still in trash — restore to root
        warning = 'Original parent was deleted or still in trash. Node restored to root level.';
        await db.node.update({
          where: { id: validated.nodeId },
          data: { parentId: null },
        });
      }
    }

    // Batch update: set deletedAt = null for node and all descendants
    await db.node.updateMany({
      where: {
        id: { in: allIds },
        ownerId: userId,
      },
      data: { deletedAt: null },
    });

    // Update storage quota — increment used bytes for restored files
    if (totalRestoredBytes > 0) {
      await db.profile.update({
        where: { userId },
        data: { storageUsedBytes: { increment: totalRestoredBytes } },
      });
    }

    // 19 — Log activity
    await logActivity({
      actorId: userId,
      nodeId: validated.nodeId,
      actionType: 'restore',
      metadata: { type: node.type, name: node.name, descendantCount: descendantIds.length },
    });

    return NextResponse.json({
      success: true,
      data: {
        restoredCount: allIds.length,
        warning,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to restore node';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
