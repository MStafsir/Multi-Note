// ============================================================
// MODUL 5: File Upload API Route
// Handles multipart file upload with quota validation
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = (formData.get('parentId') as string) || null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Max size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Reject 0-byte files
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty files (0 bytes) are not allowed' },
        { status: 400 }
      );
    }

    // Check storage quota before upload
    const profile = await db.profile.findUnique({ where: { userId } });
    const currentUsedBytes = profile ? bigintToNumber(profile.storageUsedBytes) ?? 0 : 0;
    const quotaLimitBytes = profile ? bigintToNumber(profile.quotaLimitBytes) ?? 5368709120 : 5368709120;

    if (currentUsedBytes + file.size > quotaLimitBytes) {
      return NextResponse.json(
        { success: false, error: 'Storage quota exceeded. Cannot upload this file.' },
        { status: 400 }
      );
    }

    // Check duplicate name in same parent
    const duplicate = await db.node.findFirst({
      where: {
        ownerId: userId,
        parentId: parentId || null,
        name: file.name,
        type: 'file',
        deletedAt: null,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, error: 'A file with this name already exists in this location' },
        { status: 409 }
      );
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'download', 'uploads', userId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename to avoid conflicts
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext);
    const uniqueName = `${baseName}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Create Node + FileMetadata in database
    const node = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId || null,
        type: 'file',
        name: file.name,
        metadata: {
          create: {
            storagePath: path.join('uploads', userId, uniqueName),
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            checksumSha256: checksum,
          },
        },
      },
      include: { metadata: true, note: true },
    });

    // Update storage quota
    await db.profile.upsert({
      where: { userId },
      create: {
        userId,
        storageUsedBytes: file.size,
        quotaLimitBytes: 5368709120,
      },
      update: {
        storageUsedBytes: { increment: file.size },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        actorId: userId,
        nodeId: node.id,
        actionType: 'create',
        metadata: JSON.stringify({ type: 'file', name: file.name, sizeBytes: file.size }),
      },
    });

    const metadata = node.metadata as Record<string, unknown> | null;
    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        metadata: metadata ? { ...metadata, sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null) } : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
