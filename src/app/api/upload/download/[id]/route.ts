// ============================================================
// File Download API Route
// Serves uploaded files for download with proper headers
// Auth: uses middleware-injected x-user-id header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { readFile } from 'fs/promises';
import path from 'path';

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

    if (!node || node.type !== 'file' || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    // Auth check: user must have view access to download
    const accessResult = await checkNodeAccess(userId, id, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    // Resolve file path
    const storagePath = node.metadata.storagePath;
    const fullPath = storagePath.startsWith('/') ? storagePath : path.join(UPLOAD_DIR, path.basename(storagePath));

    // Read file from disk
    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(fullPath);
    } catch {
      return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
    }

    // Serve file with download headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': node.metadata.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${node.name}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
