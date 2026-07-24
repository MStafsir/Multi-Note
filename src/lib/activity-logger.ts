// ============================================================
// MODUL 19: Shared Activity Logger — Single point of truth
// Call logActivity() from every mutation to create audit trail
// ============================================================

import { db } from '@/lib/db';

type ActionType = 'create' | 'rename' | 'move' | 'delete' | 'restore' | 'share' | 'edit';

interface LogActivityParams {
  actorId: string;
  nodeId?: string;
  actionType: ActionType;
  metadata?: Record<string, unknown>;
}

export async function logActivity({ actorId, nodeId, actionType, metadata }: LogActivityParams): Promise<void> {
  await db.activityLog.create({
    data: {
      actorId,
      nodeId: nodeId || null,
      actionType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
