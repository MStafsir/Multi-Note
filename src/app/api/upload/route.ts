// ============================================================
// MODUL 5: File Upload API Route
// Store files locally (no Supabase Storage)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadRequestSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'download', 'uploads');

// POST /api/upload — Upload a file
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;
    const checksum = formData.get('checksum') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // 5.4 — Validate max file size (500MB default)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 500MB limit' },
        { status: 400 }
      );
    }

    // 5.7 — Edge case: 0-byte file
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot upload empty file' },
        { status: 400 }
      );
    }

    // 6.1/6.2 — Quota check before upload
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });

    if (profile) {
      const remaining = profile.quotaLimitBytes - profile.storageUsedBytes;
      if (file.size > remaining) {
        return NextResponse.json(
          { success: false, error: `Storage quota exceeded. ${formatBytes(remaining)} remaining.` },
          { status: 400 }
        );
      }
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${session.user.id}/${timestamp}-${sanitizedName}`;
    const fullPath = path.join(UPLOAD_DIR, storagePath);

    // Create user directory
    await mkdir(path.join(UPLOAD_DIR, session.user.id), { recursive: true });

    // 5.6 — Write file to storage FIRST, then create DB record (prevent orphan)
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    // 5.6 — Insert node + file_metadata only after upload confirmed
    const node = await db.node.create({
      data: {
        ownerId: session.user.id,
        parentId: parentId || null,
        type: 'file',
        name: file.name,
        metadata: {
          create: {
            storagePath,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            checksumSha256: checksum || null,
          },
        },
      },
      include: { metadata: true, note: true },
    });

    // 6.1 — Update storage quota
    await db.profile.update({
      where: { userId: session.user.id },
      data: { storageUsedBytes: { increment: file.size } },
    });

    // 19 — Log activity
    await db.activityLog.create({
      data: {
        actorId: session.user.id,
        nodeId: node.id,
        actionType: 'create',
        metadata: JSON.stringify({ type: 'file', name: file.name, sizeBytes: file.size }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        deletedAt: node.deletedAt,
        metadata: node.metadata || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Helper: Format bytes for display
function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
