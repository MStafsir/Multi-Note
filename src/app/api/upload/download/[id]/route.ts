// ============================================================
// MODUL 5: File Download API Route
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';

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

    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node || node.ownerId !== session.user.id || node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    const fullPath = path.join(UPLOAD_DIR, node.metadata.storagePath);

    try {
      const fileBuffer = await readFile(fullPath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': node.metadata.mimeType,
          'Content-Disposition': `inline; filename="${node.name}"`,
          'Content-Length': String(fileBuffer.length),
        },
      });
    } catch {
      return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
