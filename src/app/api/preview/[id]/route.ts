// ============================================================
// MODUL 7: File Preview API Route
// Serves file previews based on MIME type:
// - Images: served directly with Content-Type, thumbnail support
// - PDFs: served inline with application/pdf
// - Videos: served with proper Content-Type, Range header for streaming
// - Audio: served with proper Content-Type
// - Other: returns JSON metadata only (no preview)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile, stat } from 'fs/promises';
import { open } from 'fs/promises';
import path from 'path';
import { getMimePreviewType } from '@/lib/mime-icons';
import { bigintToNumber } from '@/lib/bigint';

const UPLOAD_DIR = path.join(process.cwd(), 'download', 'uploads');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch node with metadata
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    // Auth check: user must own the node
    if (!node || node.ownerId !== session.user.id || node.type !== 'file' || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    const mimeType = node.metadata.mimeType;
    const previewType = getMimePreviewType(mimeType);
    const fullPath = path.join(UPLOAD_DIR, node.metadata.storagePath);

    // For unsupported types, return metadata JSON only
    if (previewType === 'none') {
      return NextResponse.json({
        success: true,
        data: {
          id: node.id,
          name: node.name,
          mimeType: mimeType,
          sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType: 'none',
          message: 'No preview available for this file type',
        },
      });
    }

    // Check file exists on disk
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
        // Parse Range header: "bytes=start-end"
        const fileSize = fileStat.size;
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Validate range
        if (start >= fileSize || end >= fileSize) {
          return new NextResponse(null, {
            status: 416, // Range Not Satisfiable
            headers: {
              'Content-Range': `bytes */${fileSize}`,
            },
          });
        }

        const chunkSize = end - start + 1;

        // Read the specific byte range from the file
        const fileHandle = await open(fullPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();

        return new NextResponse(buffer, {
          status: 206, // Partial Content
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

      // No Range header — serve full file
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

      // For thumbnail requests, we still serve the full image
      // (Next.js Image optimization handles resizing on the client side)
      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${node.name}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      };

      // Add thumbnail hint in response header
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

    // Fallback — should not reach here, but return metadata just in case
    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        name: node.name,
        mimeType: mimeType,
        sizeBytes: bigintToNumber(node.metadata.sizeBytes),
        previewType: 'none',
        message: 'No preview available',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
