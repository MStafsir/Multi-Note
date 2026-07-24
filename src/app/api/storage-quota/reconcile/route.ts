// ============================================================
// MODUL 6.4: Storage Quota Reconciliation API
// Detects drift between file_metadata total size and
// profile.storageUsedBytes, auto-corrects if mismatch found
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Get all file_metadata records for the user's non-deleted file nodes
    const fileNodes = await db.node.findMany({
      where: {
        ownerId: userId,
        type: 'file',
        deletedAt: null,
      },
      include: {
        metadata: true,
      },
    });

    // 2. Sum up total sizeBytes from file_metadata (convert BigInt to Number)
    let actualTotalBytes = 0;
    const fileDetails: { nodeId: string; name: string; sizeBytes: number }[] = [];

    for (const node of fileNodes) {
      if (node.metadata) {
        const sizeBytes = bigintToNumber(node.metadata.sizeBytes) || 0;
        actualTotalBytes += sizeBytes;
        fileDetails.push({
          nodeId: node.id,
          name: node.name,
          sizeBytes,
        });
      }
    }

    // 3. Get current profile.storageUsedBytes
    const profile = await db.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Create profile if it doesn't exist
      await db.profile.create({
        data: {
          userId,
          storageUsedBytes: actualTotalBytes,
          quotaLimitBytes: 5368709120, // 5 GB default
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          previousBytes: 0,
          actualBytes: actualTotalBytes,
          driftDetected: true,
          corrected: true,
          fileCount: fileDetails.length,
          files: fileDetails,
        },
      });
    }

    const recordedBytes = bigintToNumber(profile.storageUsedBytes) || 0;
    const drift = actualTotalBytes - recordedBytes;
    const driftDetected = drift !== 0;

    // 4. If drift detected, auto-correct storageUsedBytes
    if (driftDetected) {
      await db.profile.update({
        where: { userId },
        data: { storageUsedBytes: actualTotalBytes },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        previousBytes: recordedBytes,
        actualBytes: actualTotalBytes,
        driftBytes: drift,
        driftDetected,
        corrected: driftDetected,
        fileCount: fileDetails.length,
        files: fileDetails,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reconciliation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
