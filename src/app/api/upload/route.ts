// ============================================================
// MODUL 5: File Upload API Route
// Handles multipart file upload with quota validation
// MODUL 15.2: Re-upload creates new FileVersion entry
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Max versions per file (15.3 — retention limit)
const MAX_VERSIONS = 20;

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
    const existingNode = await db.node.findFirst({
      where: {
        ownerId: userId,
        parentId: parentId || null,
        name: file.name,
        type: 'file',
        deletedAt: null,
      },
      include: { metadata: true },
    });

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'download', 'uploads', userId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename to avoid conflicts
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext);
    const uniqueName = `${baseName}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);
    const newStoragePath = path.join('uploads', userId, uniqueName);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // MODUL 15.2: If duplicate exists, create a new FileVersion (re-upload)
    if (existingNode) {
      // Get next version number
      const latestVersion = await db.fileVersion.findFirst({
        where: { nodeId: existingNode.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      // Create new FileVersion entry for the re-uploaded file
      const newVersion = await db.fileVersion.create({
        data: {
          nodeId: existingNode.id,
          storagePath: newStoragePath,
          versionNumber: newVersionNumber,
          sizeBytes: file.size,
          checksumSha256: checksum,
          createdById: userId,
        },
      });

      // Update FileMetadata to point to the new current version
      await db.fileMetadata.update({
        where: { nodeId: existingNode.id },
        data: {
          storagePath: newStoragePath,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          checksumSha256: checksum,
        },
      });

      // Update node updatedAt
      const updatedNode = await db.node.update({
        where: { id: existingNode.id },
        data: { updatedAt: new Date() },
        include: { metadata: true, note: true },
      });

      // Update storage quota (new version adds to total)
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

      // Auto-prune oldest versions if > MAX_VERSIONS (15.3)
      const allVersions = await db.fileVersion.findMany({
        where: { nodeId: existingNode.id },
        orderBy: { versionNumber: 'desc' },
      });

      if (allVersions.length > MAX_VERSIONS) {
        const pruneVersions = allVersions.slice(MAX_VERSIONS);

        // Delete pruned version files from storage
        for (const pv of pruneVersions) {
          try {
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
      await db.activityLog.create({
        data: {
          actorId: userId,
          nodeId: existingNode.id,
          actionType: 'edit',
          metadata: JSON.stringify({ type: 'file', name: file.name, sizeBytes: file.size, versionNumber: newVersionNumber, action: 're-upload' }),
        },
      });

      const metadata = updatedNode.metadata as Record<string, unknown> | null;
      return NextResponse.json({
        success: true,
        data: {
          id: updatedNode.id,
          type: updatedNode.type,
          name: updatedNode.name,
          parentId: updatedNode.parentId,
          ownerId: updatedNode.ownerId,
          createdAt: updatedNode.createdAt,
          updatedAt: updatedNode.updatedAt,
          metadata: metadata ? { ...metadata, sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null) } : null,
          version: {
            id: newVersion.id,
            versionNumber: newVersion.versionNumber,
          },
        },
      });
    }

    // New file upload — create Node + FileMetadata + FileVersion v1
    const node = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId || null,
        type: 'file',
        name: file.name,
        metadata: {
          create: {
            storagePath: newStoragePath,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            checksumSha256: checksum,
          },
        },
        // Create initial FileVersion (v1)
        versions: {
          create: {
            storagePath: newStoragePath,
            versionNumber: 1,
            sizeBytes: file.size,
            checksumSha256: checksum,
            createdById: userId,
          },
        },
      },
      include: { metadata: true, note: true, versions: true },
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
        version: {
          id: node.versions[0]?.id,
          versionNumber: node.versions[0]?.versionNumber ?? 1,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
