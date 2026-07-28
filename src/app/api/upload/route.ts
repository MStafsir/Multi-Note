// ============================================================
// MODUL 5: File Upload API Route — POST handler
// Saves files to disk, creates Node + FileMetadata in DB,
// updates user storage quota, computes SHA-256 checksum
// Auth: middleware-injected x-user-id header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import crypto from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

// Map file extensions to MIME types
const EXTENSION_MIME_MAP: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.html': 'text/html',
  '.xml': 'text/xml',
  '.md': 'text/markdown',
  '.py': 'text/x-python',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
};

function getMimeTypeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_MIME_MAP[ext] || null;
}

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

// Generate a short random ID for filename uniqueness
function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex'); // 8-char hex string
}

// Sanitize original filename: remove path separators and unsafe chars
function sanitizeFilename(filename: string): string {
  // Remove any directory path components
  const base = path.basename(filename);
  // Replace characters that are unsafe for filesystems
  return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

// Compute SHA-256 checksum of a Buffer
function computeChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// POST /api/upload — Upload a file (5.2)
async function handleUpload(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Read x-user-id from middleware-injected header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;

    // 3. Validate required fields
    if (!file) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 });
    }

    if (!parentId) {
      return NextResponse.json({ success: false, error: 'Parent folder ID is required' }, { status: 400 });
    }

    // 4. Validate parent folder exists and user has access
    const parentFolder = await db.node.findFirst({
      where: {
        id: parentId,
        type: 'folder',
        deletedAt: null,
      },
    });

    if (!parentFolder) {
      return NextResponse.json(
        { success: false, error: 'Parent folder not found' },
        { status: 404 }
      );
    }

    // Verify user owns the parent folder (or has edit access via workspace/share)
    if (parentFolder.ownerId !== userId) {
      // Check workspace membership or share permissions
      const { checkNodeAccess } = await import('@/lib/permissions');
      const accessResult = await checkNodeAccess(userId, parentId, 'edit');
      if (!accessResult.hasAccess) {
        return NextResponse.json(
          { success: false, error: 'You do not have permission to upload to this folder' },
          { status: 403 }
        );
      }
    }

    // 5. Check storage quota before upload
    const profile = await db.profile.findUnique({
      where: { userId },
    });

    if (profile) {
      const currentUsage = bigintToNumber(profile.storageUsedBytes) ?? 0;
      const quotaLimit = bigintToNumber(profile.quotaLimitBytes) ?? 5368709120; // 5GB default
      if (currentUsage + file.size > quotaLimit) {
        return NextResponse.json(
          { success: false, error: 'Storage quota exceeded. Please free up space or upgrade your plan.' },
          { status: 413 }
        );
      }
    }

    // 6. Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeBytes = buffer.length;

    // 7. Compute SHA-256 checksum
    const checksumSha256 = computeChecksum(buffer);

    // 8. Generate unique filename
    const sanitizedOriginalName = sanitizeFilename(file.name);
    const timestamp = Date.now();
    const shortId = generateShortId();
    const uniqueFilename = `file-${timestamp}-${shortId}-${sanitizedOriginalName}`;

    // 9. Ensure upload directory exists for this user
    const userUploadDir = path.join(UPLOAD_DIR, 'user-files', userId);
    await mkdir(userUploadDir, { recursive: true });

    // 10. Save file to disk
    const storagePath = path.join(userUploadDir, uniqueFilename);
    await writeFile(storagePath, buffer);

    // Relative path for DB storage (so it works across different deployment paths)
    const relativeStoragePath = `user-files/${userId}/${uniqueFilename}`;

    // 11. Determine MIME type
    // Use file.type if available and specific (not generic octet-stream)
    // Otherwise, detect from filename extension
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const detectedMime = getMimeTypeFromFilename(sanitizedOriginalName);
      if (detectedMime) {
        mimeType = detectedMime;
      }
    }
    if (!mimeType) {
      mimeType = 'application/octet-stream';
    }

    // 12. Create Node record (type='file') in DB
    // Use parent's workspaceId if it has one (MODUL 40.1 — workspace-scoped nodes)
    const node = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId,
        workspaceId: parentFolder.workspaceId || null,
        type: 'file',
        name: sanitizedOriginalName,
      },
      include: { metadata: true, note: true },
    });

    // 13. Create FileMetadata record in DB
    await db.fileMetadata.create({
      data: {
        nodeId: node.id,
        storagePath: relativeStoragePath,
        mimeType: mimeType,
        sizeBytes: BigInt(sizeBytes),
        checksumSha256: checksumSha256,
      },
    });

    // 14. Update user's storageUsedBytes in Profile table
    if (profile) {
      await db.profile.update({
        where: { userId },
        data: {
          storageUsedBytes: {
            increment: BigInt(sizeBytes),
          },
        },
      });
    }

    // 15. Log activity
    await logActivity({
      actorId: userId,
      nodeId: node.id,
      actionType: 'create',
      metadata: { type: 'file', name: sanitizedOriginalName, mimeType, sizeBytes },
    });

    logger.info('file_uploaded', {
      nodeId: node.id,
      name: sanitizedOriginalName,
      mimeType,
      sizeBytes,
      checksumSha256,
      parentId,
    }, userId);

    // 16. Re-fetch node with metadata to include in response
    const nodeWithMetadata = await db.node.findUnique({
      where: { id: node.id },
      include: { metadata: true },
    });

    // 17. Return success response
    return NextResponse.json({
      success: true,
      data: {
        id: nodeWithMetadata!.id,
        name: nodeWithMetadata!.name,
        type: nodeWithMetadata!.type,
        parentId: nodeWithMetadata!.parentId,
        ownerId: nodeWithMetadata!.ownerId,
        workspaceId: nodeWithMetadata!.workspaceId,
        metadata: nodeWithMetadata!.metadata ? {
          nodeId: nodeWithMetadata!.metadata.nodeId,
          storagePath: nodeWithMetadata!.metadata.storagePath,
          mimeType: nodeWithMetadata!.metadata.mimeType,
          sizeBytes: bigintToNumber(nodeWithMetadata!.metadata.sizeBytes),
          checksumSha256: nodeWithMetadata!.metadata.checksumSha256,
        } : null,
        createdAt: nodeWithMetadata!.createdAt,
        updatedAt: nodeWithMetadata!.updatedAt,
      },
    });
  } catch (error: unknown) {
    logger.error('file_upload_failed', {}, error);
    const message = error instanceof Error ? error.message : 'File upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const POST = traceHandler(handleUpload);
