import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    // Storage quota check
    const profile = await db.profile.findUnique({ where: { userId } });
    if (profile) {
      const usedBytes = Number(profile.storageUsedBytes);
      const limitBytes = Number(profile.quotaLimitBytes);
      if (usedBytes + file.size > limitBytes) {
        return NextResponse.json(
          { success: false, error: 'Storage quota exceeded' },
          { status: 400 }
        );
      }
    }

    // Compute SHA-256 checksum
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');

    // Create node in DB
    const node = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId || null,
        type: 'file',
        name: file.name,
      },
    });

    // Store file to disk
    const storageDir = path.join(process.cwd(), 'upload', 'user-files', userId, node.id);
    await mkdir(storageDir, { recursive: true });
    const storagePath = path.join(storageDir, file.name);
    await writeFile(storagePath, buffer);

    // Create file metadata in DB
    await db.fileMetadata.create({
      data: {
        nodeId: node.id,
        storagePath: `upload/user-files/${userId}/${node.id}/${file.name}`,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        checksumSha256: checksum,
      },
    });

    // Update storage usage
    if (profile) {
      await db.profile.update({
        where: { userId },
        data: { storageUsedBytes: BigInt(Number(profile.storageUsedBytes) + file.size) },
      });
    }

    // Log activity
    await db.activityLog.create({
      data: {
        actorId: userId,
        nodeId: node.id,
        actionType: 'create',
        metadata: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        metadata: {
          nodeId: node.id,
          storagePath: `upload/user-files/${userId}/${node.id}/${file.name}`,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          checksumSha256: checksum,
        },
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
