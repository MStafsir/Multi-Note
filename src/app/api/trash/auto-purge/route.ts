// ============================================================
// MODUL 17.3: Auto-Purge API Route — Hard delete old trashed items
// Finds nodes where deletedAt > 30 days ago and permanently removes them
// Can be called manually or via scheduled task (cron equivalent)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { bigintToNumber } from '@/lib/bigint';
import { hardDeleteNode } from '@/lib/hard-delete-node';
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';

// Threshold: 30 days
const AUTO_PURGE_THRESHOLD_DAYS = 30;

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate threshold date (30 days ago from now)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - AUTO_PURGE_THRESHOLD_DAYS);

    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(userId);

    // 17.3 — Find all nodes where deletedAt > 30 days ago for this user
    const oldTrashedNodes = await db.node.findMany({
      where: {
        ...workspaceScopeFilter,
        deletedAt: { lt: thresholdDate },
      },
      select: { id: true, name: true, type: true, deletedAt: true },
    });

    if (oldTrashedNodes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { deletedCount: 0, message: 'No items older than 30 days in trash' },
      });
    }

    // Hard delete each old trashed node using the atomic shared utility (49.12c)
    let totalFreedBytes = 0;
    let deletedCount = 0;
    let failedCount = 0;

    for (const oldNode of oldTrashedNodes) {
      try {
        const result = await hardDeleteNode(oldNode.id, userId);
        if (result.deletedCount > 0) {
          totalFreedBytes += result.freedBytes;
          deletedCount++;
        }
        // If deletedCount === 0, ownership changed — skip gracefully (no side effects occurred)
      } catch {
        // Partial failure handling: continue with other nodes
        failedCount++;
      }
    }

    // Re-calculate storage_used_bytes accurately
    const { workspaceScopeFilter: scopeFilter2 } = await getWorkspaceScopeFilter(userId);
    const activeFileNodes = await db.node.findMany({
      where: {
        ...scopeFilter2,
        type: 'file',
        deletedAt: null,
      },
      include: { metadata: true },
    });

    let actualTotalBytes = 0;
    for (const f of activeFileNodes) {
      if (f.metadata) {
        actualTotalBytes += bigintToNumber(f.metadata.sizeBytes) ?? 0;
      }
    }

    await db.profile.update({
      where: { userId },
      data: { storageUsedBytes: actualTotalBytes },
    });

    // 19 — Log activity
    await logActivity({
      actorId: userId,
      actionType: 'delete',
      metadata: {
        bulk: true,
        count: deletedCount,
        failedCount,
        freedBytes: totalFreedBytes,
        action: 'auto_purge',
        thresholdDays: AUTO_PURGE_THRESHOLD_DAYS,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        failedCount,
        freedBytes: totalFreedBytes,
        thresholdDays: AUTO_PURGE_THRESHOLD_DAYS,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to auto-purge trash';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
