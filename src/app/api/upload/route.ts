// ============================================================
// MODUL 5: File Upload API Route
// Handles multipart file upload, saves to disk, creates DB records
// MODUL 49.12a: workspaceScopeFilter applied for quota check
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber, serializeBigInt } from '@/lib/bigint';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user ID from middleware-injected header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    // FormData returns empty string for missing values — normalize to null
    const parentIdRaw = formData.get('parentId');
    const parentId = (typeof parentIdRaw === 'string' && parentIdRaw.trim() !== '') ? parentIdRaw : null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 100MB)' },
        { status: 400 }
      );
    }

    // Check storage quota
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { storageUsedBytes: true, quotaLimitBytes: true },
    });

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

    // If parentId provided, verify it exists and user has access
    if (parentId) {
      const parent = await db.node.findFirst({
        where: {
          id: parentId,
          ownerId: userId,
          type: 'folder',
          deletedAt: null,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { success: false, error: 'Parent folder not found' },
          { status: 404 }
        );
      }
    }

    // Save file to disk
    await ensureUploadDir();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');
    const storagePath = path.join(UPLOAD_DIR, `${Date.now()}-${file.name}`);

    await writeFile(storagePath, fileBuffer);

    // Create DB records in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the node
      const node = await tx.node.create({
        data: {
          ownerId: userId,
          parentId: parentId || null,
          type: 'file',
          name: file.name,
        },
      });

      // Create file metadata
      await tx.fileMetadata.create({
        data: {
          nodeId: node.id,
          storagePath,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: BigInt(file.size),
          checksumSha256: checksum,
        },
      });

      // Update storage quota
      if (profile) {
        await tx.profile.update({
          where: { userId },
          data: {
            storageUsedBytes: {
              increment: BigInt(file.size),
            },
          },
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          actorId: userId,
          nodeId: node.id,
          actionType: 'create',
          metadata: JSON.stringify({ fileName: file.name, size: file.size }),
        },
      });

      return node;
    });

    // Return the created node — serialize BigInt fields for JSON
    const createdNode = await db.node.findUnique({
      where: { id: result.id },
      include: { metadata: true },
    });

    // serializeBigInt converts all BigInt fields to Number for JSON.stringify
    const serializedData = {
      id: createdNode!.id,
      name: createdNode!.name,
      type: createdNode!.type,
      parentId: createdNode!.parentId,
      metadata: createdNode!.metadata
        ? serializeBigInt(createdNode!.metadata as Record<string, unknown>)
        : null,
      createdAt: createdNode!.createdAt,
      updatedAt: createdNode!.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: serializedData,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
