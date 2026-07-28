// ============================================================
// MODUL 50-51 Phase 1: File Content Streaming Route
// Serves RAW file bytes (not converted content) with Range support
// Auth: middleware-injected x-user-id header
// Supports ?download=true for forced download (Content-Disposition: attachment)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { buildRangeResponse } from '@/lib/range-response';
import { stat } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

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

    // 5. Resolve storagePath (absolute path or join with UPLOAD_DIR)
    const storagePath = node.metadata.storagePath;
    const fullPath = storagePath.startsWith('/')
      ? storagePath
      : path.join(UPLOAD_DIR, path.basename(storagePath));

    // 6. Read file stats to get fileSize
    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch {
      return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
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
