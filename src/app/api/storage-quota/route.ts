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

    const percentage = profile.quotaLimitBytes > 0
      ? Math.round((bigintToNumber(profile.storageUsedBytes) / bigintToNumber(profile.quotaLimitBytes)) * 100)
      : 0;

    // Determine tier from quota limit
    const tierKey: QuotaTierKey = getTierFromLimit(bigintToNumber(profile.quotaLimitBytes));
    const tierInfo = getTierInfo(tierKey);

    return NextResponse.json({
      success: true,
      data: {
        usedBytes: bigintToNumber(profile.storageUsedBytes),
        limitBytes: bigintToNumber(profile.quotaLimitBytes),
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
