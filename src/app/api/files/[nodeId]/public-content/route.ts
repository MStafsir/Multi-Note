// ============================================================
// MODUL 54.7: Public File Content Endpoint
// Serves file content using a temporary access token instead
// of NextAuth session authentication. This enables external
// services (e.g., Google Docs Viewer) to access file content
// without requiring a user session.
//
// Usage: GET /api/files/[nodeId]/public-content?token=TEMP_TOKEN
// Token is generated server-side in /view/[nodeId]/page.tsx
// and passed to the client for constructing Google Docs URLs.
//
// Token is valid for 5 minutes (not one-time-use, since Google Docs
// Viewer may make multiple HTTP requests to the same URL).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validatePublicAccessToken } from '@/lib/public-file-access';
import { buildRangeResponse } from '@/lib/range-response';
import { resolveStoragePath } from '@/lib/storage-path';
import { stat } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    // 1. Validate the temporary access token from query parameter
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token required' }, { status: 401 });
    }

    const { nodeId } = await params;

    if (!validatePublicAccessToken(token, nodeId)) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    // 2. Lookup node by nodeId from DB with metadata
    const node = await db.node.findUnique({
      where: { id: nodeId },
      include: { metadata: true },
    });

    // 3. If not found, type !== 'file', or deleted → 404
    if (!node || node.type !== 'file' || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    // 4. Resolve storagePath using shared utility (handles all 3 path formats)
    const storagePath = node.metadata.storagePath;
    const fullPath = resolveStoragePath(storagePath);

    // 5. Read file stats to get fileSize
    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch {
      return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
    }

    const fileSize = fileStat.size;
    const mimeType = node.metadata.mimeType;
    const fileName = node.name;
    const checksumSha256 = node.metadata.checksumSha256 ?? undefined;

    // 6. Build Range response (same as authenticated content endpoint)
    const rangeHeader = request.headers.get('range');

    return buildRangeResponse({
      filePath: fullPath,
      fileSize,
      mimeType,
      fileName,
      checksumSha256,
      rangeHeader,
      isDownload: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'File content streaming failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
