// ============================================================
// MODUL 5: File Upload API Route
// Accepts FormData (file + parentId), stores locally,
// creates Node + FileMetadata, updates storage quota
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

// Max file size: 50MB per upload
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Base directory for file storage
const UPLOAD_BASE_DIR = join(process.cwd(), 'upload', 'user-files');

async function handleUpload(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
        { status: 400 }
      );
    }

    // Check storage quota
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });

    const currentUsage = bigintToNumber(profile?.storageUsedBytes) ?? 0;
    const quotaLimit = bigintToNumber(profile?.quotaLimitBytes) ?? 5 * 1024 * 1024 * 1024; // 5GB default

    if (currentUsage + file.size > quotaLimit) {
      return NextResponse.json(
        { success: false, error: 'Storage quota exceeded. Please upgrade your plan or delete some files.' },
        { status: 403 }
      );
    }

    // Sanitize filename — remove path traversal characters
    const sanitizedFileName = file.name.replace(/[/\\<>:"|?*\x00-\x1f]/g, '_');

    // Get file buffer and compute checksum
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    // Create Node record first (need the ID for storage path)
    const node = await db.node.create({
      data: {
        ownerId: session.user.id,
        parentId: parentId || null,
        type: 'file',
        name: sanitizedFileName,
      },
    });

    // Create storage directory for this file
    const userDir = join(UPLOAD_BASE_DIR, session.user.id, node.id);
    await mkdir(userDir, { recursive: true });

    // Write file to local filesystem
    const storagePath = join(userDir, sanitizedFileName);
    await writeFile(storagePath, buffer);

    // Create FileMetadata record
    await db.fileMetadata.create({
      data: {
        nodeId: node.id,
        storagePath: storagePath,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        checksumSha256: checksumSha256,
      },
    });

    // Update storage usage in profile
    const newUsage = currentUsage + file.size;
    if (profile) {
      await db.profile.update({
        where: { userId: session.user.id },
        data: { storageUsedBytes: BigInt(newUsage) },
      });
    } else {
      // Create profile if it doesn't exist
      await db.profile.create({
        data: {
          userId: session.user.id,
          role: 'user',
          storageUsedBytes: BigInt(file.size),
          quotaLimitBytes: BigInt(5 * 1024 * 1024 * 1024),
        },
      });
    }

    // Log activity
    await logActivity({
      actorId: session.user.id,
      nodeId: node.id,
      actionType: 'create',
      metadata: { type: 'file', name: sanitizedFileName, mimeType: file.type, sizeBytes: file.size },
    });

    logger.info('file_uploaded', {
      nodeId: node.id,
      fileName: sanitizedFileName,
      mimeType: file.type,
      sizeBytes: file.size,
      parentId: parentId,
    }, session.user.id);

    // Fetch the complete node with metadata for response
    const fullNode = await db.node.findUnique({
      where: { id: node.id },
      include: { metadata: true, note: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: fullNode!.id,
        type: fullNode!.type,
        name: fullNode!.name,
        parentId: fullNode!.parentId,
        ownerId: fullNode!.ownerId,
        isFavorite: fullNode!.isFavorite,
        createdAt: fullNode!.createdAt,
        updatedAt: fullNode!.updatedAt,
        metadata: fullNode!.metadata ? {
          nodeId: fullNode!.metadata.nodeId,
          storagePath: fullNode!.metadata.storagePath,
          mimeType: fullNode!.metadata.mimeType,
          sizeBytes: bigintToNumber(fullNode!.metadata.sizeBytes),
          checksumSha256: fullNode!.metadata.checksumSha256,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('file_upload_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const POST = traceHandler(handleUpload);
