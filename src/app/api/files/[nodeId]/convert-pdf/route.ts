// ============================================================
// GET /api/files/[nodeId]/convert-pdf
// Converts a DOCX/XLSX/PPTX file to PDF using LibreOffice headless.
// Returns the converted PDF as a streaming response.
//
// Auth: middleware-injected x-user-id header
// Access: checkNodeAccess(userId, nodeId, 'view')
//
// Supported MIME types:
// - application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX)
// - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
// - application/vnd.openxmlformats-officedocument.presentationml.presentation (PPTX)
// - application/msword (DOC)
// - application/vnd.ms-excel (XLS)
// - application/vnd.ms-powerpoint (PPT)
// - application/vnd.oasis.opendocument.* (ODT, ODS, ODP)
//
// If the file is already a PDF, redirect to /content.
// If the file type is not convertible, return 400.
//
// Response: streaming PDF with:
//   Content-Type: application/pdf
//   Content-Disposition: inline; filename="<original-name>.pdf"
//   Cache-Control: private, max-age=3600
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { resolveStoragePath, getUploadDir } from '@/lib/storage-path';
import { buildRangeResponse } from '@/lib/range-response';
import { convertToPdf, isConvertibleMimeType, isPdfMimeType } from '@/lib/lo-convert';
import { stat, readdir } from 'fs/promises';
import { join } from 'path';

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

    const mimeType = node.metadata.mimeType;
    const storagePath = node.metadata.storagePath;
    const checksumSha256 = node.metadata.checksumSha256 ?? undefined;

    // 5. If already a PDF, redirect to /content endpoint
    if (isPdfMimeType(mimeType)) {
      return NextResponse.redirect(
        new URL(`/api/files/${nodeId}/content`, request.url)
      );
    }

    // 6. Check if the MIME type is convertible
    if (!isConvertibleMimeType(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `File type '${mimeType}' is not convertible to PDF. Supported formats: DOCX, XLSX, PPTX, DOC, XLS, PPT, ODT, ODS, ODP.`,
        },
        { status: 400 }
      );
    }

    // 7. Check checksum is available (required for cache key)
    if (!checksumSha256) {
      return NextResponse.json(
        { success: false, error: 'File checksum missing — cannot convert without cache key' },
        { status: 400 }
      );
    }

    // 8. Resolve storage path
    let fullPath = resolveStoragePath(storagePath);

    // 9. Verify source file exists on disk — self-heal if not found
    try {
      await stat(fullPath);
    } catch {
      // Self-healing: try to find the file by name in the user's upload directories
      const UPLOAD_DIR = getUploadDir();
      const parts = storagePath.split('/');
      const dirUserId = parts.length >= 2 ? parts[1] : null;
      let repaired = false;

      if (dirUserId) {
        const sanitizedNodeName = node.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const nodeBaseName = sanitizedNodeName.replace(/\.[^.]+$/, '').toLowerCase();

        // Search in both current and legacy upload directories
        const searchDirs = [
          join(UPLOAD_DIR, dirUserId),
          join(UPLOAD_DIR, 'user-files', dirUserId),
        ];

        for (const searchDir of searchDirs) {
          if (repaired) break;
          try {
            const files = await readdir(searchDir);
            for (const file of files) {
              const fileLower = file.toLowerCase();
              if (fileLower.includes(nodeBaseName) || fileLower.includes(sanitizedNodeName.toLowerCase())) {
                const newFullPath = join(searchDir, file);
                try {
                  const fStat = await stat(newFullPath);
                  if (!fStat.isFile()) continue;
                  fullPath = newFullPath;
                  // Update DB record
                  const relativePath = newFullPath.replace(UPLOAD_DIR + '/', '').replace(UPLOAD_DIR + '\\', '');
                  const newStoragePath = relativePath.startsWith('user-files/')
                    ? `upload/${relativePath}`
                    : relativePath.startsWith('upload/')
                      ? relativePath
                      : `upload/${relativePath}`;
                  try {
                    await db.fileMetadata.update({
                      where: { nodeId },
                      data: { storagePath: newStoragePath },
                    });
                    console.log(`[Self-heal convert-pdf] Updated storagePath for node ${nodeId}: ${storagePath} → ${newStoragePath}`);
                  } catch { /* non-critical */ }
                  repaired = true;
                  break;
                } catch { continue; }
              }
            }
          } catch { /* directory not found */ }
        }
      }

      if (!repaired) {
        return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
      }
    }

    // 10. Convert to PDF (uses cache if available)
    let pdfPath: string;
    try {
      pdfPath = await convertToPdf(fullPath, checksumSha256);
    } catch (conversionError: unknown) {
      const message = conversionError instanceof Error
        ? conversionError.message
        : 'LibreOffice conversion failed';
      console.error(`[convert-pdf] Conversion failed for node ${nodeId}:`, message);
      return NextResponse.json(
        { success: false, error: `PDF conversion failed: ${message}` },
        { status: 500 }
      );
    }

    // 11. Get PDF file stats
    let pdfStat;
    try {
      pdfStat = await stat(pdfPath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Converted PDF not found on disk' },
        { status: 500 }
      );
    }

    const pdfFileSize = pdfStat.size;

    // 12. Derive the PDF filename from the original name
    const originalName = node.name;
    const pdfFileName = originalName.replace(/\.[^.]+$/, '') + '.pdf';

    // 13. Build streaming response with Range support
    const rangeHeader = request.headers.get('range');

    return buildRangeResponse({
      filePath: pdfPath,
      fileSize: pdfFileSize,
      mimeType: 'application/pdf',
      fileName: pdfFileName,
      checksumSha256,
      rangeHeader,
      isDownload: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PDF conversion failed';
    console.error('[convert-pdf] Unhandled error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
