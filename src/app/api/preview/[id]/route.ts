// ============================================================
// MODUL 7: File Preview API Route
// Serves file previews based on MIME type:
// - Images: served directly with Content-Type, thumbnail support
// - PDFs: served inline with application/pdf
// - Videos: served with proper Content-Type, Range header for streaming
// - Audio: served with proper Content-Type
// - Text/code: served as UTF-8 text for inline rendering
// - Office/docs: served for download (no browser-native preview)
// - Other: returns JSON metadata + download link
// Auth: uses middleware-injected x-user-id header (not getServerSession)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { readFile, stat, open } from 'fs/promises';
import path from 'path';
import { getMimePreviewType } from '@/lib/mime-icons';
import { bigintToNumber } from '@/lib/bigint';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user ID from middleware-injected header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch node with metadata
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    // Auth check: user must have view access
    if (!node || node.type !== 'file' || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const accessResult = await checkNodeAccess(userId, id, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    const mimeType = node.metadata.mimeType;
    const previewType = getMimePreviewType(mimeType);
    // Storage path from metadata — could be absolute or relative
    const storagePath = node.metadata.storagePath;
    const fullPath = storagePath.startsWith('/') ? storagePath : path.join(UPLOAD_DIR, path.basename(storagePath));

    // --- Text/code files: serve as UTF-8 text for inline preview ---
    if (previewType === 'text') {
      let fileBuffer: Buffer;
      try {
        fileBuffer = await readFile(fullPath);
      } catch {
        return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
      }
      const textContent = fileBuffer.toString('utf-8');
      return new NextResponse(textContent, {
        headers: {
          'Content-Type': `${mimeType}; charset=utf-8`,
          'Content-Disposition': `inline; filename="${node.name}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // --- Office/unsupported types: serve as download + metadata ---
    if (previewType === 'none' || previewType === 'download') {
      // Return metadata JSON with download URL
      return NextResponse.json({
        success: true,
        data: {
          id: node.id,
          name: node.name,
          mimeType: mimeType,
          sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType: 'none',
          downloadUrl: `/api/upload/download/${id}`,
          message: 'No inline preview available — download to view',
        },
      });
    }

    // Check file exists on disk for binary preview types
    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch {
      return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
    }

    // --- Video/Audio: Support Range header for streaming ---
    if (previewType === 'video' || previewType === 'audio') {
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const fileSize = fileStat.size;
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }

        const chunkSize = end - start + 1;
        const fileHandle = await open(fullPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${node.name}"`,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }

      const fileBuffer = await readFile(fullPath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${node.name}"`,
          'Content-Length': String(fileBuffer.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // --- Image: Serve with proper Content-Type ---
    if (previewType === 'image') {
      const url = new URL(request.url);
      const sizeParam = url.searchParams.get('size');
      const fileBuffer = await readFile(fullPath);

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${node.name}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      };

      if (sizeParam === 'thumbnail') {
        headers['X-Preview-Size'] = 'thumbnail';
      }

      return new NextResponse(fileBuffer, { headers });
    }

    // --- PDF: Serve inline ---
    if (previewType === 'pdf') {
      const fileBuffer = await readFile(fullPath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${node.name}"`,
          'Content-Length': String(fileBuffer.length),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Fallback
    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        name: node.name,
        mimeType: mimeType,
        sizeBytes: bigintToNumber(node.metadata.sizeBytes),
        previewType: 'none',
        downloadUrl: `/api/upload/download/${id}`,
        message: 'No preview available',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
