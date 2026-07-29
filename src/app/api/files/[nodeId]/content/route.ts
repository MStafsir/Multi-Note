// ============================================================
// MODUL 50-51 Phase 1: File Content Streaming Route
// Serves RAW file bytes (not converted content) with Range support
// Auth: middleware-injected x-user-id header
// Supports ?download=true for forced download (Content-Disposition: attachment)
//
// Self-healing: if the resolved storagePath doesn't exist on disk,
// searches the upload directory for a file matching the node name,
// and updates the DB record so future requests are fast.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { buildRangeResponse } from '@/lib/range-response';
import { stat, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { resolveStoragePath, getUploadDir } from '@/lib/storage-path';

/**
 * Self-healing: when the resolved storagePath doesn't point to an existing file,
 * search the upload directory for a file whose name contains the original filename.
 * This handles legacy storage paths from the old upload system that no longer exist.
 *
 * Strategy:
 * 1. Extract the userId from the old storagePath (second path segment)
 * 2. List files in upload/{userId}/ directory
 * 3. Find a file whose sanitized name matches the node's original name
 * 4. If found, update the DB record with the correct storage path
 * 5. Return the resolved absolute path
 */
async function findAndRepairStoragePath(
  nodeId: string,
  originalStoragePath: string,
  nodeName: string
): Promise<string | null> {
  const UPLOAD_DIR = getUploadDir();

  // Extract userId from the old storage path
  // Old format: user-files/{userId}/file-{ts}-{hash}-{name}
  // or: upload/{userId}/{uuid}-{sanitized_name}
  const parts = originalStoragePath.split('/');
  const userId = parts.length >= 2 ? parts[1] : null;
  if (!userId) return null;

  // Sanitize the node name the same way the upload route does
  const sanitizedNodeName = nodeName.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Remove extension for matching
  const nodeBaseName = sanitizedNodeName.replace(/\.[^.]+$/, '').toLowerCase();

  // Directories to search (in order of preference):
  // 1. upload/{userId}/ — current upload system
  // 2. upload/user-files/{userId}/ — legacy upload system
  const searchDirs = [
    join(UPLOAD_DIR, userId),
    join(UPLOAD_DIR, 'user-files', userId),
  ];

  for (const searchDir of searchDirs) {
    try {
      await stat(searchDir);
    } catch {
      continue; // Directory doesn't exist, try next
    }

    try {
      const files = await readdir(searchDir);

      for (const file of files) {
        const fileLower = file.toLowerCase();
        // Check if the file contains the node name (sanitized)
        if (fileLower.includes(nodeBaseName) || fileLower.includes(sanitizedNodeName.toLowerCase())) {
          const newFullPath = join(searchDir, file);

          // Verify the file actually exists (not a directory)
          try {
            const fStat = await stat(newFullPath);
            if (!fStat.isFile()) continue;
          } catch {
            continue;
          }

          // Determine the new storagePath relative to UPLOAD_DIR
          const relativePath = newFullPath.replace(UPLOAD_DIR + '/', '').replace(UPLOAD_DIR + '\\', '');
          // Normalize: use upload/ prefix for the new path
          const newStoragePath = relativePath.startsWith('user-files/')
            ? `upload/${relativePath}`
            : relativePath.startsWith('upload/')
              ? relativePath
              : `upload/${relativePath}`;

          // Self-heal: update the DB record with the correct path
          try {
            await db.fileMetadata.update({
              where: { nodeId },
              data: { storagePath: newStoragePath },
            });
            console.log(`[Self-heal] Updated storagePath for node ${nodeId}: ${originalStoragePath} → ${newStoragePath}`);
          } catch (dbError) {
            console.warn(`[Self-heal] Could not update DB for node ${nodeId}:`, dbError);
          }

          return newFullPath;
        }
      }
    } catch (err) {
      console.warn(`[Self-heal] Error searching in ${searchDir}:`, err);
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    // 1. Read x-user-id from middleware-injected header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { nodeId } = await params;

    // 2. Lookup node by nodeId from DB with metadata
    const node = await db.node.findUnique({
      where: { id: nodeId },
      include: { metadata: true },
    });

    // 3. If not found, type !== 'file', or deleted → 404
    if (!node || node.type !== 'file' || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    // 4. Check access via permission system
    const accessResult = await checkNodeAccess(userId, nodeId, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    // 5. Resolve storagePath to absolute filesystem path
    const storagePath = node.metadata.storagePath;
    let fullPath = resolveStoragePath(storagePath);

    // 6. Read file stats to get fileSize
    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch {
      // Self-healing: file not found at expected path, try to find it
      const repairedPath = await findAndRepairStoragePath(nodeId, storagePath, node.name);
      if (repairedPath) {
        fullPath = repairedPath;
        try {
          fileStat = await stat(fullPath);
        } catch {
          return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
        }
      } else {
        return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
      }
    }

    const fileSize = fileStat.size;
    const mimeType = node.metadata.mimeType;
    const fileName = node.name;
    // Handle BigInt serialization for checksumSha256
    const checksumSha256 = node.metadata.checksumSha256 ?? undefined;

    // 7. Check ?download=true query parameter
    const downloadParam = request.nextUrl.searchParams.get('download');
    const isDownload = downloadParam === 'true';

    // 8. Build Range response
    const rangeHeader = request.headers.get('range');

    return buildRangeResponse({
      filePath: fullPath,
      fileSize,
      mimeType,
      fileName,
      checksumSha256,
      rangeHeader,
      isDownload,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'File content streaming failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
