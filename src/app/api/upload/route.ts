import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;
    const workspaceId = formData.get('workspaceId') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: `File too large. Max ${MAX_FILE_SIZE / (1024 * 1024)}MB` }, { status: 413 });
    }

    const profile = await db.profile.findUnique({ where: { userId } });
    if (profile) {
      const usedBytes = bigintToNumber(profile.storageUsedBytes) || 0;
      const limitBytes = bigintToNumber(profile.quotaLimitBytes) || 5368709120;
      if (usedBytes + file.size > limitBytes) {
        return NextResponse.json({ success: false, error: 'Storage quota exceeded' }, { status: 507 });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nodeId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const storageDir = path.join(process.cwd(), 'upload', 'user-files', userId, nodeId);
    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, originalName), buffer);

    const node = await db.node.create({
      data: { ownerId: userId, workspaceId: workspaceId || null, parentId: parentId || null, type: 'file', name: originalName },
      include: { metadata: true, note: true },
    });

    await db.fileMetadata.create({
      data: {
        nodeId: node.id,
        storagePath: `upload/user-files/${userId}/${nodeId}/${originalName}`,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        checksumSha256: checksum,
      },
    });

    if (profile) {
      await db.profile.update({ where: { userId }, data: { storageUsedBytes: { increment: BigInt(file.size) } } });
    }

    await logActivity({ actorId: userId, nodeId: node.id, actionType: 'create', metadata: { fileType: 'file_upload', fileName: originalName, sizeBytes: file.size } });
    logger.info('file_uploaded', { nodeId: node.id, fileName: originalName, sizeBytes: file.size }, userId);

    const metadata = await db.fileMetadata.findUnique({ where: { nodeId: node.id } });

    return NextResponse.json({
      success: true,
      data: {
        id: node.id, name: node.name, type: node.type, parentId: node.parentId,
        createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString(),
        metadata: metadata ? {
          nodeId: metadata.nodeId, storagePath: metadata.storagePath, mimeType: metadata.mimeType,
          sizeBytes: bigintToNumber(metadata.sizeBytes), checksumSha256: metadata.checksumSha256,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('upload_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
