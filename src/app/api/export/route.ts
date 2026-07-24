// ============================================================
// Module 28: Data Export API Route
// POST endpoint: Creates async export job, generates ZIP with
// original files + notes as Markdown, returns download link (24h expiry)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiptapToMarkdown } from '@/lib/tiptap-to-md';
import archiver from 'archiver';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { bigintToNumber } from '@/lib/bigint';

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Query all non-deleted nodes for the user (including metadata and note content)
    const nodes = await db.node.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
      include: {
        metadata: true,
        note: true,
        tags: { include: { tag: true } },
        parent: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No data to export' }, { status: 400 });
    }

    // Build folder path mapping (nodeId → path)
    const pathMap = new Map<string, string>();
    const folderNodes = nodes.filter(n => n.type === 'folder');
    const fileNodes = nodes.filter(n => n.type === 'file');
    const noteNodes = nodes.filter(n => n.type === 'note');

    // First pass: assign paths to root-level nodes
    for (const node of nodes) {
      if (!node.parentId) {
        pathMap.set(node.id, node.name);
      }
    }

    // Build paths for nested nodes (iterative, handles any depth)
    let resolvedCount = 0;
    let prevResolved = -1;
    while (resolvedCount < nodes.length && resolvedCount > prevResolved) {
      prevResolved = resolvedCount;
      for (const node of nodes) {
        if (pathMap.has(node.id)) continue;
        if (node.parentId && pathMap.has(node.parentId)) {
          const parentPath = pathMap.get(node.parentId)!;
          pathMap.set(node.id, `${parentPath}/${node.name}`);
          resolvedCount++;
        }
      }
    }

    // For any unresolved nodes (orphaned due to deleted parent), assign root-level path
    for (const node of nodes) {
      if (!pathMap.has(node.id)) {
        pathMap.set(node.id, node.name);
      }
    }

    // Generate unique ZIP filename
    const zipFileName = `export-${user.email}-${Date.now()}.zip`;
    const uploadDir = path.join(process.cwd(), 'download', 'uploads', userId);
    await mkdir(uploadDir, { recursive: true });
    const uniqueZipName = `export-${crypto.randomBytes(8).toString('hex')}.zip`;
    const zipPath = path.join(uploadDir, uniqueZipName);
    const storagePath = `uploads/${userId}/${uniqueZipName}`;

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 6 } });

    // Write ZIP to disk
    const outputBuffers: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => {
      outputBuffers.push(chunk);
    });

    // Track archive completion
    let archiveFinished = false;
    let archiveError: string | null = null;

    archive.on('end', () => {
      archiveFinished = true;
    });

    archive.on('error', (err: Error) => {
      archiveError = err.message;
    });

    // Add folders to ZIP
    for (const folder of folderNodes) {
      const folderPath = pathMap.get(folder.id) || folder.name;
      archive.directory({}, folderPath + '/');
    }

    // Add files to ZIP
    for (const file of fileNodes) {
      if (!file.metadata) continue;
      const filePath = pathMap.get(file.id) || file.name;
      const sourcePath = path.join(process.cwd(), 'download', file.metadata.storagePath);

      try {
        archive.file(sourcePath, { name: filePath });
      } catch {
        // If the source file doesn't exist, skip it
        // Add a placeholder text file noting the missing original
        archive.append(`[Original file missing: ${file.name}]`, { name: filePath + '.missing.txt' });
      }
    }

    // Add notes to ZIP as Markdown files
    for (const note of noteNodes) {
      const notePath = (pathMap.get(note.id) || note.name) + '.md';
      const contentJson = note.note?.contentJson || '';
      const markdown = tiptapToMarkdown(contentJson);
      archive.append(markdown, { name: notePath });
    }

    // Add metadata file with export info
    const exportMeta = {
      exportDate: new Date().toISOString(),
      userEmail: user.email,
      userName: user.name,
      totalNodes: nodes.length,
      folders: folderNodes.length,
      files: fileNodes.length,
      notes: noteNodes.length,
      nodeDetails: nodes.map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        parentId: n.parentId,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        tags: n.tags.map(t => ({ name: t.tag.name, color: t.tag.colorHex })),
      })),
    };
    archive.append(JSON.stringify(exportMeta, null, 2), { name: 'export-metadata.json' });

    // Finalize archive
    await archive.finalize();

    if (archiveError) {
      return NextResponse.json({ success: false, error: `Export failed: ${archiveError}` }, { status: 500 });
    }

    // Write ZIP to disk
    const zipBuffer = Buffer.concat(outputBuffers);
    await writeFile(zipPath, zipBuffer);

    // Create a temporary export node (file type) with the ZIP as its metadata
    const exportNode = await db.node.create({
      data: {
        ownerId: userId,
        parentId: null,
        type: 'file',
        name: zipFileName,
        metadata: {
          create: {
            storagePath,
            mimeType: 'application/zip',
            sizeBytes: zipBuffer.length,
            checksumSha256: crypto.createHash('sha256').update(zipBuffer).digest('hex'),
          },
        },
      },
    });

    // Create NodeShare with 24h expiry download link
    const shareToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const share = await db.nodeShare.create({
      data: {
        nodeId: exportNode.id,
        sharedWithUserId: null, // public link
        permissionLevel: 'view',
        shareLinkToken: shareToken,
        shareLinkExpiry: expiresAt,
        linkType: 'public',
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        actorId: userId,
        nodeId: exportNode.id,
        actionType: 'create',
        metadata: JSON.stringify({
          type: 'export',
          totalNodes: nodes.length,
          zipSize: zipBuffer.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        downloadLink: `/api/export/${shareToken}`,
        expiresAt: expiresAt.toISOString(),
        totalNodes: nodes.length,
        folders: folderNodes.length,
        files: fileNodes.length,
        notes: noteNodes.length,
        zipSizeBytes: zipBuffer.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
