// ============================================================
// Upload API Route — handles file uploads for all file types
// Middleware skips header modification for upload POST (line 320-322),
// so request.formData() works properly.
// JWT token is read directly via getToken() since middleware
// doesn't inject x-user-id for upload POST routes.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { bigintToNumber } from '@/lib/bigint';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const UPLOAD_DIR = join(process.cwd(), 'upload');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// MIME type mapping by file extension
const EXT_TO_MIME: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
  '.avif': 'image/avif', '.ico': 'image/ico',
  // PDF
  '.pdf': 'application/pdf',
  // Video
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
  '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
  // Audio
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.aac': 'audio/aac', '.m4a': 'audio/x-m4a', '.oga': 'audio/ogg',
  // Text
  '.txt': 'text/plain', '.csv': 'text/csv', '.html': 'text/html',
  '.css': 'text/css', '.xml': 'text/xml', '.md': 'text/markdown',
  '.json': 'application/json', '.js': 'application/javascript',
  '.ts': 'application/typescript', '.py': 'text/x-python',
  '.log': 'text/plain', '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.toml': 'text/plain', '.ini': 'text/plain', '.env': 'text/plain',
  // Office
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
  // Archives
  '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed', '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
};

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read JWT token directly (middleware skips header modification for upload POST)
    const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
    if (!token?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.id as string;

    // 2. Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formDataError) {
      console.error('[Upload] FormData parsing failed:', formDataError);
      return NextResponse.json(
        { success: false, error: 'Failed to parse upload data. Please try again.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // 3. File size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // 4. Get parentId (optional — null means root level)
    const parentIdEntry = formData.get('parentId');
    const parentId = parentIdEntry && parentIdEntry !== 'null' && parentIdEntry !== ''
      ? parentIdEntry as string
      : null;

    // 5. Determine MIME type
    const mimeType = file.type || getMimeType(file.name);

    // 6. Generate unique storage path
    const uniqueId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFileName = `${uniqueId}-${safeName}`;
    const storageRelativePath = `upload/${userId}/${storageFileName}`;
    const fullStoragePath = join(UPLOAD_DIR, userId, storageFileName);

    // 7. Create user directory if needed
    const userDir = join(UPLOAD_DIR, userId);
    await mkdir(userDir, { recursive: true });

    // 8. Write file to filesystem
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(fullStoragePath, buffer);

    // 9. Compute SHA-256 checksum
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    // 10. Create Node + FileMetadata in DB
    const newNode = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId,
        type: 'file',
        name: file.name,
        workspaceId: null,
        metadata: {
          create: {
            storagePath: storageRelativePath,
            mimeType: mimeType,
            sizeBytes: BigInt(file.size),
            checksumSha256: checksumSha256,
          },
        },
      },
      include: { metadata: true },
    });

    // 11. Update storage quota
    try {
      await db.profile.update({
        where: { userId },
        data: { storageUsedBytes: { increment: BigInt(file.size) } },
      });
    } catch (quotaError) {
      // Profile might not exist for OAuth users yet — create it
      try {
        await db.profile.create({
          data: {
            userId,
            role: 'user',
            storageUsedBytes: BigInt(file.size),
            quotaLimitBytes: BigInt(5368709120), // 5GB
          },
        });
      } catch {
        console.warn('[Upload] Could not update/create storage quota:', quotaError);
      }
    }

    // 12. Return success response
    return NextResponse.json({
      success: true,
      data: {
        id: newNode.id,
        name: newNode.name,
        type: newNode.type,
        parentId: newNode.parentId,
        metadata: newNode.metadata ? {
          nodeId: newNode.metadata.nodeId,
          storagePath: newNode.metadata.storagePath,
          mimeType: newNode.metadata.mimeType,
          sizeBytes: bigintToNumber(newNode.metadata.sizeBytes),
          checksumSha256: newNode.metadata.checksumSha256,
        } : null,
        createdAt: newNode.createdAt,
        updatedAt: newNode.updatedAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Upload] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
