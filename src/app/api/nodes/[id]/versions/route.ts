// ============================================================
// MODUL 15: File Version History API Routes
// GET — List all versions for a file node (sorted desc)
// POST — Restore a specific version (non-destructive)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';

// Max versions per file (15.3 — retention limit)
const MAX_VERSIONS = 20;

// Zod validation for restore request body
const restoreVersionSchema = z.object({
  versionId: z.string().min(1, 'Version ID is required'),
});

// GET /api/nodes/[id]/versions — List all versions for a file node
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check node exists and user owns it
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'Node is not a file' }, { status: 400 });
    }

    if (node.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Fetch all versions sorted by version_number desc
    const versions = await db.fileVersion.findMany({
      where: { nodeId: id },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        sizeBytes: true,
        createdAt: true,
        checksumSha256: true,
      },
    });

    // Calculate total size of all versions (15.6 — storage cost visibility)
    const totalSizeBytes = versions.reduce((sum, v) => sum + bigintToNumber(v.sizeBytes) ?? 0, 0);

    const serializedVersions = versions.map(v => ({
      id: v.id,
      versionNumber: v.versionNumber,
      sizeBytes: bigintToNumber(v.sizeBytes),
      createdAt: v.createdAt,
      checksumSha256: v.checksumSha256,
    }));

    return NextResponse.json({
      success: true,
      data: {
        versions: serializedVersions,
        totalSizeBytes,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch versions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/nodes/[id]/versions — Restore a specific version (non-destructive, 15.4)
// Creates a NEW version from the old version's file content (NOT overwrites current)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = restoreVersionSchema.parse(body);

    // Check node exists and user owns it
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'Node is not a file' }, { status: 400 });
    }

    if (node.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Find the target version to restore
    const targetVersion = await db.fileVersion.findUnique({
      where: { id: validated.versionId },
    });

    if (!targetVersion || targetVersion.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }

    // Read the old version's file from storage
    const oldStoragePath = targetVersion.storagePath;
    const oldFilePath = path.join(process.cwd(), 'download', oldStoragePath);

    const { readFile } = await import('fs/promises');
    const fileBuffer = await readFile(oldFilePath);

    // Copy the old version's file to a new storage path (non-destructive)
    const ext = path.extname(node.name) || '';
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const newStorageFileName = `${path.basename(node.name, ext)}-v${targetVersion.versionNumber}-restore-${uniqueSuffix}${ext}`;
    const uploadDir = path.join(process.cwd(), 'download', 'uploads', userId);
    await mkdir(uploadDir, { recursive: true });
    const newFilePath = path.join(uploadDir, newStorageFileName);

    await writeFile(newFilePath, fileBuffer);

    // Calculate new checksum
    const newChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Get next version number
    const latestVersion = await db.fileVersion.findFirst({
      where: { nodeId: id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
    const newStoragePath = path.join('uploads', userId, newStorageFileName);

    // Create a new FileVersion entry (non-destructive restore)
    const newVersion = await db.fileVersion.create({
      data: {
        nodeId: id,
        storagePath: newStoragePath,
        versionNumber: newVersionNumber,
        sizeBytes: targetVersion.sizeBytes,
        checksumSha256: newChecksum,
        createdById: userId,
      },
    });

    // Update FileMetadata.storagePath to point to new current version
    await db.fileMetadata.update({
      where: { nodeId: id },
      data: {
        storagePath: newStoragePath,
        sizeBytes: targetVersion.sizeBytes,
        checksumSha256: newChecksum,
      },
    });

    // Update node updatedAt
    await db.node.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Update storage quota — new version adds to total storage
    await db.profile.update({
      where: { userId },
      data: { storageUsedBytes: { increment: bigintToNumber(targetVersion.sizeBytes) ?? 0 } },
    });

    // Auto-prune oldest versions if > MAX_VERSIONS (15.3)
    const allVersions = await db.fileVersion.findMany({
      where: { nodeId: id },
      orderBy: { versionNumber: 'desc' },
    });

    if (allVersions.length > MAX_VERSIONS) {
      const pruneVersions = allVersions.slice(MAX_VERSIONS);

      // Delete pruned version files from storage
      for (const pv of pruneVersions) {
        try {
          const { unlink } = await import('fs/promises');
          const pruneFilePath = path.join(process.cwd(), 'download', pv.storagePath);
          await unlink(pruneFilePath);
        } catch {
          // File may already be deleted, ignore errors
        }
      }

      // Delete pruned version records from database
      await db.fileVersion.deleteMany({
        where: {
          id: { in: pruneVersions.map(pv => pv.id) },
        },
      });

      // Subtract pruned storage from quota
      const prunedSize = pruneVersions.reduce((sum, pv) => sum + (bigintToNumber(pv.sizeBytes) ?? 0), 0);
      if (prunedSize > 0) {
        await db.profile.update({
          where: { userId },
          data: { storageUsedBytes: { decrement: prunedSize } },
        });
      }
    }

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId: id,
      actionType: 'restore',
      metadata: { versionId: validated.versionId, versionNumber: targetVersion.versionNumber, restoredAs: newVersionNumber },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: newVersion.id,
        versionNumber: newVersion.versionNumber,
        sizeBytes: bigintToNumber(newVersion.sizeBytes),
        createdAt: newVersion.createdAt,
        checksumSha256: newVersion.checksumSha256,
        restoredFrom: {
          versionId: targetVersion.id,
          versionNumber: targetVersion.versionNumber,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to restore version';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
