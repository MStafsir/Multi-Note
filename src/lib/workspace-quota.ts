// ============================================================
// MODUL 41: Workspace Quota & Seat Management
// Seat limits per plan tier, storage limits, downgrade guards
// ============================================================

import { db } from '@/lib/db';
import { QUOTA_TIERS } from '@/lib/quota';

// 41.2 — Seat limits per plan tier
export const SEAT_LIMITS: Record<string, number> = {
  free: 3,
  pro: 10,
  enterprise: 50,
};

// Storage limits per workspace plan tier (extends Module 6.3 quota engine)
export const WORKSPACE_STORAGE_LIMITS: Record<string, bigint> = {
  free: BigInt(QUOTA_TIERS.free.limitBytes),   // 5 GB
  pro: BigInt(QUOTA_TIERS.pro.limitBytes),      // 50 GB
  enterprise: BigInt(QUOTA_TIERS.enterprise.limitBytes), // 500 GB
};

/**
 * Get current seat count for a workspace (members with joinedAt set).
 */
export async function getCurrentSeatCount(workspaceId: string): Promise<number> {
  const count = await db.workspaceMember.count({
    where: {
      workspaceId,
      joinedAt: { not: null }, // only count accepted members
    },
  });
  return count;
}

/**
 * Check if a workspace can add more seats based on its plan tier.
 */
export async function canAddSeat(workspaceId: string): Promise<{ allowed: boolean; currentSeats: number; maxSeats: number }> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { planTier: true },
  });

  if (!workspace) {
    return { allowed: false, currentSeats: 0, maxSeats: 0 };
  }

  const maxSeats = SEAT_LIMITS[workspace.planTier] || SEAT_LIMITS.free;
  const currentSeats = await getCurrentSeatCount(workspaceId);

  return {
    allowed: currentSeats < maxSeats,
    currentSeats,
    maxSeats,
  };
}

/**
 * Get the storage limit for a workspace based on its plan tier.
 */
export function getWorkspaceStorageLimit(planTier: string): bigint {
  return WORKSPACE_STORAGE_LIMITS[planTier] || WORKSPACE_STORAGE_LIMITS.free;
}

/**
 * Get the current storage used by a workspace (sum of all node metadata sizes).
 */
export async function getWorkspaceStorageUsed(workspaceId: string): Promise<bigint> {
  const nodes = await db.node.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    include: {
      metadata: true,
    },
  });

  let totalBytes = BigInt(0);
  for (const node of nodes) {
    if (node.metadata?.sizeBytes) {
      totalBytes += node.metadata.sizeBytes;
    }
  }

  return totalBytes;
}

/**
 * 41.3 — Downgrade guard: check if downgrade is possible.
 * Returns blockers if downgrade would violate limits (seats or storage).
 */
export async function canDowngradePlan(
  workspaceId: string,
  newTier: string
): Promise<{ allowed: boolean; blockers: string[] }> {
  const blockers: string[] = [];

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { planTier: true },
  });

  if (!workspace) {
    return { allowed: false, blockers: ['Workspace not found'] };
  }

  // Cannot downgrade to same or higher tier
  const tierOrder = { free: 0, pro: 1, enterprise: 2 };
  const currentTierOrder = tierOrder[workspace.planTier as keyof typeof tierOrder] ?? 0;
  const newTierOrder = tierOrder[newTier as keyof typeof tierOrder] ?? 0;

  if (newTierOrder >= currentTierOrder) {
    return { allowed: true, blockers: [] }; // upgrading or same tier is always allowed
  }

  // 41.3 — Check seat limits
  const currentSeats = await getCurrentSeatCount(workspaceId);
  const newMaxSeats = SEAT_LIMITS[newTier] || SEAT_LIMITS.free;

  if (currentSeats > newMaxSeats) {
    blockers.push(
      `Current members (${currentSeats}) exceed new tier limit (${newMaxSeats}). Remove ${currentSeats - newMaxSeats} members first.`
    );
  }

  // 41.3 — Check storage limits
  const storageUsed = await getWorkspaceStorageUsed(workspaceId);
  const newStorageLimit = getWorkspaceStorageLimit(newTier);

  if (storageUsed > newStorageLimit) {
    blockers.push(
      `Current storage (${Number(storageUsed / BigInt(1024 * 1024))} MB) exceeds new tier limit (${Number(newStorageLimit / BigInt(1024 * 1024))} MB). Free up space first.`
    );
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}
