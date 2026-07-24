// ============================================================
// MODUL 17.3: Auto-Purge API Route — Hard delete old trashed items
// Finds nodes where deletedAt > 30 days ago and permanently removes them
// Can be called manually or via scheduled task (cron equivalent)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { bigintToNumber } from '@/lib/bigint';
import { unlink } from 'fs/promises';
import path from 'path';

// Threshold: 30 days
const AUTO_PURGE_THRESHOLD_DAYS = 30;

/**
 * Hard-delete a single node and all its associated records.
 * Reuses the same logic as purge route.
 */
async function hardDeleteNode(nodeId: string): Promise<number> {
  const node = await db.node.findUnique({
    where: { id: nodeId },
    include: {
      metadata: true,
      note: true,
      versions: true,
      revisions: true,
      shares: true,
      tags: true,
    },
  });

  if (!node) return 0;

  let freedBytes = 0;

  // Delete file from disk + metadata
  if (node.type === 'file' && node.metadata) {
    const fullPath = path.join(process.cwd(), 'download', node.metadata.storagePath);
    try {
      await unlink(fullPath);
    } catch {
      // File might already be deleted from disk — continue gracefully
    }
    freedBytes = bigintToNumber(node.metadata.sizeBytes) ?? 0;
    await db.fileMetadata.delete({ where: { nodeId: node.id } });
  }

  // Delete file versions from disk + DB
  if (node.versions && node.versions.length > 0) {
    for (const version of node.versions) {
      try {
        await unlink(path.join(process.cwd(), 'download', version.storagePath));
      } catch {
        // Continue on failure
      }
    }
    await db.fileVersion.deleteMany({ where: { nodeId: node.id } });
  }

  // Delete note content
  if (node.note) {
    await db.noteContent.delete({ where: { nodeId: node.id } });
  }

  // Delete note revisions
  await db.noteRevision.deleteMany({ where: { nodeId: node.id } });

  // Delete shares
  await db.nodeShare.deleteMany({ where: { nodeId: node.id } });

  // Delete tag associations
  await db.nodeTag.deleteMany({ where: { nodeId: node.id } });

  // Set ActivityLog nodeId to null (onDelete: SetNull)
  await db.activityLog.updateMany({
    where: { nodeId: node.id },
    data: { nodeId: null },
  });

  // Hard delete the node row
  await db.node.delete({ where: { id: node.id } });

  return freedBytes;
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate threshold date (30 days ago from now)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - AUTO_PURGE_THRESHOLD_DAYS);

    // 17.3 — Find all nodes where deletedAt > 30 days ago for this user
    const oldTrashedNodes = await db.node.findMany({
      where: {
        ownerId: userId,
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

    // Hard delete each old trashed node
    let totalFreedBytes = 0;
    let deletedCount = 0;
    let failedCount = 0;

    for (const oldNode of oldTrashedNodes) {
      try {
        const freedBytes = await hardDeleteNode(oldNode.id);
        totalFreedBytes += freedBytes;
        deletedCount++;
      } catch {
        // Partial failure handling: continue with other nodes
        failedCount++;
      }
    }

    // Re-calculate storage_used_bytes accurately
    const activeFileNodes = await db.node.findMany({
      where: {
        ownerId: userId,
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
