// ============================================================
// MODUL 5: File Upload API Route
// POST — Upload file to current folder
// Auth via middleware-injected x-user-id header (defense-in-depth)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Auth: middleware injects x-user-id header after JWT validation
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    // Check storage quota
    const profile = await db.profile.findUnique({
      where: { userId },
    });

    if (profile) {
      const usedBytes = bigintToNumber(profile.storageUsedBytes) || 0;
      const limitBytes = bigintToNumber(profile.quotaLimitBytes) || 5368709120;
      if (usedBytes + file.size > limitBytes) {
        return NextResponse.json(
          { success: false, error: 'Storage quota exceeded' },
          { status: 507 }
        );
      }
    }

    // Calculate SHA-256 checksum
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksum = createHash('sha256').update(buffer).digest('hex');

    // Sanitize filename
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nodeId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Storage path: upload/user-files/{userId}/{nodeId}/{originalName}
    const storageDir = path.join(
      process.cwd(),
      'upload',
      'user-files',
      userId,
      nodeId
    );
    const storagePath = path.join(storageDir, originalName);

    // Ensure directory exists
    await mkdir(storageDir, { recursive: true });

    // Write file to local storage
    await writeFile(storagePath, buffer);

    // Create node in database
    const node = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId || null,
        type: 'file',
        name: originalName,
      },
      include: {
        metadata: true,
        note: true,
      },
    });

    // Create file metadata
    await db.fileMetadata.create({
      data: {
        nodeId: node.id,
        storagePath: `upload/user-files/${userId}/${nodeId}/${originalName}`,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        checksumSha256: checksum,
      },
    });

    // Update storage usage in profile
    if (profile) {
      await db.profile.update({
        where: { userId },
        data: {
          storageUsedBytes: { increment: BigInt(file.size) },
        },
      });
    }

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId: node.id,
      actionType: 'create',
      metadata: { fileType: 'file_upload', fileName: originalName, sizeBytes: file.size },
    });

    logger.info('file_uploaded', { nodeId: node.id, fileName: originalName, sizeBytes: file.size }, userId);

    // Return node data with metadata
    const metadata = await db.fileMetadata.findUnique({
      where: { nodeId: node.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
        metadata: metadata ? {
          nodeId: metadata.nodeId,
          storagePath: metadata.storagePath,
          mimeType: metadata.mimeType,
          sizeBytes: bigintToNumber(metadata.sizeBytes),
          checksumSha256: metadata.checksumSha256,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('upload_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
