// ============================================================
// Storage Quota API Route
// Returns user's current storage usage and quota limit
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
      return NextResponse.json({
        success: true,
        data: {
          usedBytes: 0,
          limitBytes: 5368709120, // 5GB
          percentage: 0,
        },
      });
    }

    const percentage = profile.quotaLimitBytes > 0
      ? Math.round((profile.storageUsedBytes / profile.quotaLimitBytes) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        usedBytes: profile.storageUsedBytes,
        limitBytes: profile.quotaLimitBytes,
        percentage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch storage quota';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
