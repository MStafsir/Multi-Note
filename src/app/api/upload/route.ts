// ============================================================
// MODUL 59: Upload API Route — handles file uploads for ALL file types
// Middleware skips header modification for upload POST (line 320-322),
// so request.formData() works properly.
// JWT token is read directly via getToken() since middleware
// doesn't inject x-user-id for upload POST routes.
//
// MIME type resolution: loose with fallback to extension.
// If browser sends generic MIME (application/octet-stream, empty),
// we use the file extension to determine the correct MIME type.
// This ensures DOCX from any source (MS Word, Google Docs, LibreOffice)
// is accepted regardless of what MIME the browser reports.
//
// Filename handling: original filename preserved in DB for display,
// sanitized filename used for storage path only (no brackets/special chars).
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
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB — set to 0 to disable limit

// MIME type mapping by file extension — comprehensive list
const EXT_TO_MIME: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.heic': 'image/heic',
  '.heif': 'image/heif',
  // PDF
  '.pdf': 'application/pdf',
  // Video
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
  '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4', '.3gp': 'video/3gpp', '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  // Audio
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.aac': 'audio/aac', '.m4a': 'audio/x-m4a', '.oga': 'audio/ogg',
  '.opus': 'audio/opus', '.wma': 'audio/x-ms-wma',
  // Text
  '.txt': 'text/plain', '.csv': 'text/csv', '.html': 'text/html',
  '.htm': 'text/html', '.css': 'text/css', '.xml': 'text/xml',
  '.md': 'text/markdown', '.rtf': 'text/rtf',
  '.json': 'application/json', '.js': 'application/javascript',
  '.ts': 'application/typescript', '.py': 'text/x-python',
  '.log': 'text/plain', '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.toml': 'text/plain', '.ini': 'text/plain', '.env': 'text/plain',
  '.sh': 'text/x-shellscript', '.bat': 'text/plain', '.ps1': 'text/plain',
  '.sql': 'text/x-sql', '.php': 'application/x-httpd-php',
  // Office — DOCX/XLSX/PPTX (multiple sources may report different MIMEs)
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  // Archives
  '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed', '.tar': 'application/x-tar',
  '.gz': 'application/gzip', '.bz2': 'application/x-bzip2',
};

// Generic MIME types that browsers sometimes send for known file types
// These should be overridden by extension-based detection
const GENERIC_MIME_TYPES = new Set([
  'application/octet-stream',
  'application/binary',
  '',
]);

/**
 * Resolve MIME type: prefer browser-reported type, but fall back to
 * extension-based detection if browser sends a generic/ambiguous MIME.
 * This ensures DOCX from any source (MS Word, Google Docs export,
 * LibreOffice, WPS) is correctly identified regardless of browser MIME.
 */
function resolveMimeType(browserMime: string, filename: string): string {
  // If browser gave us a specific, non-generic MIME — trust it
  if (browserMime && !GENERIC_MIME_TYPES.has(browserMime)) {
    return browserMime;
  }

  // Browser sent generic MIME or empty — use extension-based detection
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const extensionMime = EXT_TO_MIME[ext];
  if (extensionMime) {
    return extensionMime;
  }

  // No extension mapping found — keep browser MIME if it was non-empty,
  // otherwise use generic octet-stream
  return browserMime || 'application/octet-stream';
}

/**
 * Sanitize filename for storage path — replace special chars with underscores.
 * Original filename is preserved in DB for display.
 * Handles brackets, spaces, and other problematic characters.
 */
function sanitizeForStorage(filename: string): string {
  // Replace characters that are problematic in file paths (brackets, spaces, etc.)
  // Keep only alphanumeric, dots, hyphens, and underscores
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    console.log('[Upload] Request received, content-type:', contentType, 'content-length:', contentLength);

    // 1. Read JWT token directly (middleware skips header modification for upload POST)
    const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
    if (!token?.id) {
      console.warn('[Upload] No valid token found');
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
      console.warn('[Upload] No file in FormData. Keys:', [...formData.keys()]);
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    console.log('[Upload] File received:', file.name, 'size:', file.size, 'type:', file.type);

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

    // 5. Resolve MIME type — loose with extension fallback (MODUL 59.6)
    // If browser sends generic MIME (application/octet-stream, empty),
    // we use file extension to determine the correct MIME.
    const mimeType = resolveMimeType(file.type, file.name);

    // 6. Generate unique storage path
    // Original filename preserved in DB, sanitized for storage only
    const uniqueId = crypto.randomUUID();
    const safeName = sanitizeForStorage(file.name);
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

    // 10. Create Node + FileMetadata in DB — original filename preserved
    const newNode = await db.node.create({
      data: {
        ownerId: userId,
        parentId: parentId,
        type: 'file',
        name: file.name, // Original filename with special chars preserved
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
            quotaLimitBytes: BigInt(5368709120000), // 5TB — effectively unlimited
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
    console.error('[Upload] Unhandled error:', message, error instanceof Error ? error.stack : '');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET handler — diagnostic endpoint for upload debugging
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Upload endpoint is active. Use POST with multipart/form-data to upload files.',
    maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
    supportedTypes: 'All file types accepted — MIME resolved from extension when browser sends generic type',
  });
}
