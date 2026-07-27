// ============================================================
// MODUL 17.4: Trash Purge API Route — Empty trash (hard delete)
// Permanently removes all trashed nodes and associated data
// Requires explicit confirmation
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { bigintToNumber } from '@/lib/bigint';
import { hardDeleteNode } from '@/lib/hard-delete-node';
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';
import { z } from 'zod';

const purgeSchema = z.object({
  confirm: z.boolean(),
  confirmText: z.string(),
});

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

    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(userId);

    // Find all trashed nodes for this user
    const trashedNodes = await db.node.findMany({
      where: {
        ...workspaceScopeFilter,
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

    // Hard delete each trashed node using the atomic shared utility (49.12c)
    let totalFreedBytes = 0;
    let deletedCount = 0;
    let failedCount = 0;

    for (const trashedNode of trashedNodes) {
      try {
        const result = await hardDeleteNode(trashedNode.id, userId);
        if (result.deletedCount > 0) {
          totalFreedBytes += result.freedBytes;
          deletedCount++;
        }
        // If deletedCount === 0, ownership changed — skip gracefully (no side effects occurred)
      } catch {
        // 18.6 — Partial failure handling: continue with other nodes
        failedCount++;
      }
    }

    // Re-calculate storage_used_bytes by reconciling actual file sizes
    // This is more accurate than just decrementing
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
