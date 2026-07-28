// ============================================================
// MODUL 49.14: Profile Reconciliation Utility
// Runs at startup or on-demand to fix orphaned User records
// (users without corresponding Profile entries).
// Prevents quota bypass if profile creation silently failed
// during a past registration race condition.
// ============================================================

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Reconcile orphaned users — create missing Profile records.
 * Returns the count of profiles created.
 *
 * Call this at startup (in middleware or a dedicated init endpoint)
 * or periodically via a cron health-check.
 */
export async function reconcileOrphanedProfiles(): Promise<{
  orphanedCount: number;
  fixedCount: number;
}> {
  const allUsers = await db.user.findMany({
    select: { id: true, email: true, createdAt: true },
  });

  const allProfiles = await db.profile.findMany({
    select: { userId: true },
  });

  const profileUserIds = new Set(allProfiles.map(p => p.userId));
  const orphanedUsers = allUsers.filter(u => !profileUserIds.has(u.id));

  if (orphanedUsers.length === 0) {
    logger.info('profile_reconcile_ok', { message: 'All users have profiles' }, null);
    return { orphanedCount: 0, fixedCount: 0 };
  }

  logger.warn('profile_reconcile_orphans_found', {
    count: orphanedUsers.length,
    emails: orphanedUsers.map(u => u.email),
  }, null);

  let fixedCount = 0;
  for (const orphan of orphanedUsers) {
    try {
      await db.profile.create({
        data: {
          userId: orphan.id,
          role: 'user',
          storageUsedBytes: BigInt(0),
          quotaLimitBytes: BigInt(5368709120), // 5GB default
        },
      });
      fixedCount++;
      logger.info('profile_reconcile_fixed', { userId: orphan.id, email: orphan.email }, null);
    } catch (err) {
      logger.error('profile_reconcile_failed', { userId: orphan.id, email: orphan.email }, err);
    }
  }

  return { orphanedCount: orphanedUsers.length, fixedCount };
}
