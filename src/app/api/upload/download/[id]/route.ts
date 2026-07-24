// ============================================================
// MODUL 5: File Download API Route
// Serves file from local storage with owner check
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';

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

    // Get node with metadata
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node || node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    // Owner check
    if (node.ownerId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata not found' }, { status: 404 });
    }

    const storagePath = node.metadata.storagePath;
    const fullPath = path.join(process.cwd(), 'download', storagePath);

    // Read file from disk
    const fileBuffer = await readFile(fullPath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': node.metadata.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${node.name}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
