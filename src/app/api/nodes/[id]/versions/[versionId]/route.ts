// ============================================================
// MODUL 15.4: Download Specific File Version
// GET — Stream a specific version's file from storage
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';
import { checkNodeAccess } from '@/lib/permissions';

// GET /api/nodes/[id]/versions/[versionId] — Download a specific version
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, versionId } = await params;

    // Check node exists and user owns it
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'Node is not a file' }, { status: 400 });
    }

    // Verify view access (owner OR workspace member OR share recipient)
    const viewAccess = await checkNodeAccess(userId, id, 'view');
    if (!viewAccess.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Find the specific version
    const version = await db.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }

    // Stream file from storage path
    const storagePath = version.storagePath;
    const fullPath = path.join(process.cwd(), 'download', storagePath);

    const fileBuffer = await readFile(fullPath);

    // Set proper Content-Disposition header with filename and version number
    const ext = path.extname(node.name) || '';
    const baseName = path.basename(node.name, ext);
    const downloadFilename = `${baseName}-v${version.versionNumber}${ext}`;

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': node.metadata?.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
