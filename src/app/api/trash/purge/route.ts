// ============================================================
// MODUL 17.4: Trash Purge API Route — Empty trash (hard delete)
// Permanently removes all trashed nodes and associated data
// Requires explicit confirmation
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { bigintToNumber } from '@/lib/bigint';
import { unlink } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

const purgeSchema = z.object({
  confirm: z.boolean(),
  confirmText: z.string(),
});

/**
 * Hard-delete a single trashed node and all its associated records.
 * Handles file deletion from disk, metadata, notes, shares, tags, etc.
 */
async function hardDeleteNode(nodeId: string): Promise<number> {
  // Get node with all associated data
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
    const storagePath = node.metadata.storagePath;
    const fullPath = path.join(process.cwd(), 'download', storagePath);

    try {
      await unlink(fullPath);
    } catch {
      // File might already be deleted from disk — continue gracefully
    }

    freedBytes = bigintToNumber(node.metadata.sizeBytes) ?? 0;

    // Delete FileMetadata record
    await db.fileMetadata.delete({ where: { nodeId: node.id } });
  }

  // Delete file versions (and their disk files)
  if (node.versions && node.versions.length > 0) {
    for (const version of node.versions) {
      const versionPath = path.join(process.cwd(), 'download', version.storagePath);
      try {
        await unlink(versionPath);
      } catch {
        // Version file may already be gone — continue
      }
    }
    await db.fileVersion.deleteMany({ where: { nodeId: node.id } });
  }

  // Delete note content
  if (node.note) {
    await db.noteContent.delete({ where: { nodeId: node.id } });
  }

  // Delete note revisions
  if (node.revisions && node.revisions.length > 0) {
    await db.noteRevision.deleteMany({ where: { nodeId: node.id } });
  }

  // Delete shares
  if (node.shares && node.shares.length > 0) {
    await db.nodeShare.deleteMany({ where: { nodeId: node.id } });
  }

  // Delete tags associations
  if (node.tags && node.tags.length > 0) {
    await db.nodeTag.deleteMany({ where: { nodeId: node.id } });
  }

  // Set ActivityLog nodeId to null (onDelete: SetNull in schema)
  await db.activityLog.updateMany({
    where: { nodeId: node.id },
    data: { nodeId: null },
  });

  // Hard delete the node row itself
  await db.node.delete({ where: { id: node.id } });

  return freedBytes;
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = purgeSchema.parse(body);

    // Must have explicit confirmation
    if (!validated.confirm || validated.confirmText !== 'I understand this is permanent') {
      return NextResponse.json(
        { success: false, error: 'Confirmation required. Send confirm=true and confirmText="I understand this is permanent"' },
        { status: 400 }
      );
    }

    // Find all trashed nodes for this user
    const trashedNodes = await db.node.findMany({
      where: {
        ownerId: userId,
        deletedAt: { not: null },
      },
      select: { id: true },
    });

    if (trashedNodes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { deletedCount: 0 },
      });
    }

    // Hard delete each trashed node (with all associated data)
    let totalFreedBytes = 0;
    let deletedCount = 0;
    let failedCount = 0;

    for (const trashedNode of trashedNodes) {
      try {
        const freedBytes = await hardDeleteNode(trashedNode.id);
        totalFreedBytes += freedBytes;
        deletedCount++;
      } catch {
        // 18.6 — Partial failure handling: continue with other nodes
        failedCount++;
      }
    }

    // Re-calculate storage_used_bytes by reconciling actual file sizes
    // This is more accurate than just decrementing
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
      metadata: { bulk: true, count: deletedCount, failedCount, freedBytes: totalFreedBytes, action: 'purge_trash' },
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        failedCount,
        freedBytes: totalFreedBytes,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to purge trash';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
