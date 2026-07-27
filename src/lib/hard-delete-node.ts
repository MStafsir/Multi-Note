// ============================================================
// MODUL 49.12c: Atomic Hard-Delete Utility — TOCTOU Mitigation
// Shared utility for permanently removing a node and all its
// associated records. Used by purge and auto-purge routes.
// ============================================================

import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { unlink } from 'fs/promises';
import path from 'path';

export interface HardDeleteResult {
  deletedCount: number;
  freedBytes: number;
  filePathsDeleted: string[];
}

/**
 * Atomic hard-delete with TOCTOU mitigation.
 *
 * Pattern: pre-fetch file paths for disk cleanup, then delete the node row
 * FIRST with ownerId verification inside a transaction, then clean up
 * orphaned side-effect data. If ownership changed between check and delete,
 * the node row won't be deleted (count=0) and we abort without side effects.
 *
 * Disk file cleanup happens AFTER successful DB transaction since filesystem
 * can't participate in rollback — but we only proceed to disk cleanup if the
 * DB transaction succeeded.
 *
 * @param nodeId      - The node to hard-delete
 * @param ownerId     - The user who must own the node (authorization)
 * @param workspaceId - Optional workspace scope:
 *                       undefined = don't filter by workspace (default, for purge routes)
 *                       null      = personal workspace only (workspaceId IS NULL)
 *                       string    = team workspace only
 */
export async function hardDeleteNode(
  nodeId: string,
  ownerId: string,
  workspaceId?: string | null
): Promise<HardDeleteResult> {
  // ------------------------------------------------------------------
  // Step 0: Pre-transaction — gather file paths for disk cleanup
  // This is NOT for authorization; it's just to know what files to
  // clean up later. The authorization is done atomically by deleteMany
  // inside the transaction.
  // ------------------------------------------------------------------
  const node = await db.node.findFirst({
    where: { id: nodeId, ownerId },
    include: {
      metadata: true,
      versions: true,
    },
  });

  // If node not found at all, no need to start a transaction
  if (!node) {
    return { deletedCount: 0, freedBytes: 0, filePathsDeleted: [] };
  }

  // Collect disk paths for cleanup after successful transaction
  const diskPaths: string[] = [];
  let freedBytes = 0;

  if (node.type === 'file' && node.metadata) {
    diskPaths.push(node.metadata.storagePath);
    freedBytes = bigintToNumber(node.metadata.sizeBytes) ?? 0;
  }
  if (node.versions && node.versions.length > 0) {
    for (const version of node.versions) {
      diskPaths.push(version.storagePath);
    }
  }

  // ------------------------------------------------------------------
  // Step 1: Atomic transaction — delete node + side-effect data
  // ------------------------------------------------------------------
  const result = await db.$transaction(async (tx) => {
    // 1a: Verify ownership AND delete atomically.
    // Using deleteMany with ownerId in WHERE ensures atomicity:
    // if ownerId changed, count=0 and we don't proceed to side effects.
    const ownershipFilter: {
      id: string;
      ownerId: string;
      workspaceId?: string | null;
    } = { id: nodeId, ownerId };

    if (workspaceId !== undefined) {
      // undefined  → don't filter by workspace (purge routes delete across all workspaces)
      // null       → filter for personal workspace (workspaceId IS NULL)
      // string    → filter for team workspace
      ownershipFilter.workspaceId = workspaceId;
    }

    const deleteResult = await tx.node.deleteMany({
      where: ownershipFilter,
    });

    if (deleteResult.count === 0) {
      // Ownership changed or node doesn't exist — abort without side effects
      return { deletedCount: 0 };
    }

    // 1b: Node successfully deleted — now clean up orphaned side-effect data.
    // These are safe because the node row is already gone (verified by deleteMany count).
    // deleteMany does NOT trigger Prisma cascade deletes, so we must clean up manually.

    // File metadata
    try {
      await tx.fileMetadata.delete({ where: { nodeId } });
    } catch {
      /* may not exist */
    }

    // File versions
    await tx.fileVersion.deleteMany({ where: { nodeId } });

    // Note content
    try {
      await tx.noteContent.delete({ where: { nodeId } });
    } catch {
      /* may not exist */
    }

    // Note revisions
    await tx.noteRevision.deleteMany({ where: { nodeId } });

    // Node shares
    await tx.nodeShare.deleteMany({ where: { nodeId } });

    // Node tags
    await tx.nodeTag.deleteMany({ where: { nodeId } });

    // Activity logs — set nodeId to null instead of delete (preserve audit trail)
    await tx.activityLog.updateMany({
      where: { nodeId },
      data: { nodeId: null },
    });

    return { deletedCount: deleteResult.count };
  });

  // ------------------------------------------------------------------
  // Step 2: Disk file cleanup (only if DB transaction succeeded)
  // Filesystem can't participate in rollback, so we only proceed if
  // the DB transaction confirmed the node was deleted.
  // ------------------------------------------------------------------
  const filePathsDeleted: string[] = [];

  if (result.deletedCount > 0) {
    for (const storagePath of diskPaths) {
      const fullPath = path.join(process.cwd(), 'download', storagePath);
      try {
        await unlink(fullPath);
        filePathsDeleted.push(storagePath);
      } catch {
        // File might already be deleted from disk — continue gracefully
      }
    }
  }

  return {
    deletedCount: result.deletedCount,
    freedBytes: result.deletedCount > 0 ? freedBytes : 0,
    filePathsDeleted,
  };
}
