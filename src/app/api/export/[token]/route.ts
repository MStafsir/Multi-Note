// ============================================================
// Module 28: Export Download Route
// GET endpoint: Validates shareLinkToken and streams ZIP file
// Public route (no auth required — token-based access)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the share by token
    const share = await db.nodeShare.findUnique({
      where: { shareLinkToken: token },
      include: { node: { include: { metadata: true } } },
    });

    if (!share) {
      return NextResponse.json({ success: false, error: 'Download link not found' }, { status: 404 });
    }

    // Check expiry
    if (share.shareLinkExpiry && new Date() > share.shareLinkExpiry) {
      return NextResponse.json({ success: false, error: 'Download link has expired' }, { status: 410 });
    }

    // Check that the node is an export file (ZIP)
    const node = share.node;
    if (!node || node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'Export file not found' }, { status: 404 });
    }

    const metadata = node.metadata;
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'File metadata not found' }, { status: 404 });
    }

    // Read the ZIP file from disk
    const fullPath = path.join(process.cwd(), 'download', metadata.storagePath);
    const zipBuffer = await readFile(fullPath);

    // Return the ZIP as a downloadable file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${node.name}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
