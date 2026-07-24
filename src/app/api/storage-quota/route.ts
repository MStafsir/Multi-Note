// ============================================================
// MODUL 6.1/6.5: Storage Quota API Route
// Returns user's current storage usage, quota limit, and tier info
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { QUOTA_TIERS, DEFAULT_TIER, getTierFromLimit, getTierInfo } from '@/lib/quota';
import type { QuotaTierKey } from '@/lib/quota';
import { bigintToNumber } from '@/lib/bigint';
import { createNotification } from '@/lib/notification-sender';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      // Return defaults if profile doesn't exist
      const defaultTier = QUOTA_TIERS[DEFAULT_TIER];
      return NextResponse.json({
        success: true,
        data: {
          usedBytes: 0,
          limitBytes: defaultTier.limitBytes,
          percentage: 0,
          tier: {
            key: DEFAULT_TIER,
            name: defaultTier.name,
            label: defaultTier.label,
          },
        },
      });
    }

    const usedBytes = bigintToNumber(profile.storageUsedBytes) ?? 0;
    const limitBytes = bigintToNumber(profile.quotaLimitBytes) ?? QUOTA_TIERS[DEFAULT_TIER].limitBytes;
    const percentage = limitBytes > 0
      ? Math.round((usedBytes / limitBytes) * 100)
      : 0;

    // Determine tier from quota limit
    const tierKey: QuotaTierKey = getTierFromLimit(limitBytes);
    const tierInfo = getTierInfo(tierKey);

    // 20 — Create quota_warning notification when usage >= 90%
    if (percentage >= 90) {
      await createNotification({
        recipientId: session.user.id,
        type: 'quota_warning',
        payload: {
          percentage,
          usedBytes,
          limitBytes,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        usedBytes,
        limitBytes,
        percentage,
        tier: {
          key: tierKey,
          name: tierInfo.name,
          label: tierInfo.label,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch storage quota';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
