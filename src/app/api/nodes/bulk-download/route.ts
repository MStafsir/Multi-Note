// ============================================================
// MODUL 18.4: Bulk Download API Route — ZIP streaming
// POST: Create ZIP archive of selected nodes and stream it
// For folders, includes all descendant files
// Uses archiver for ZIP creation with streaming response
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAllDescendants } from '@/lib/permissions';
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import * as archiver from 'archiver';
import { z } from 'zod';

const bulkDownloadSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(50),
});

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = bulkDownloadSchema.parse(body);

    // Verify all nodes belong to this user and are active
    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(userId);
    const nodes = await db.node.findMany({
      where: {
        id: { in: validated.nodeIds },
        ...workspaceScopeFilter,
        deletedAt: null,
      },
      include: { metadata: true },
    });

    if (nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid active nodes found' }, { status: 404 });
    }

    // Collect all file nodes (expand folders to include descendant files)
    const fileEntries: { nodeId: string; name: string; storagePath: string; filePath: string }[] = [];
    const noteEntries: { nodeId: string; name: string; contentJson: string }[] = [];

    for (const node of nodes) {
      if (node.type === 'file' && node.metadata) {
        fileEntries.push({
          nodeId: node.id,
          name: node.name,
          storagePath: node.metadata.storagePath,
          filePath: path.join(process.cwd(), 'download', node.metadata.storagePath),
        });
      } else if (node.type === 'note' && node.note) {
        // Export note as JSON content
        const noteContent = await db.noteContent.findUnique({ where: { nodeId: node.id } });
        if (noteContent) {
          noteEntries.push({
            nodeId: node.id,
            name: node.name,
            contentJson: noteContent.contentJson,
          });
        }
      } else if (node.type === 'folder') {
        // Get all descendant files for the folder
        const descendantIds = await getAllDescendants(node.id, userId, node.workspaceId);
        const descendants = await db.node.findMany({
          where: {
            id: { in: descendantIds },
            deletedAt: null,
          },
          include: { metadata: true, note: true },
        });

        for (const desc of descendants) {
          if (desc.type === 'file' && desc.metadata) {
            fileEntries.push({
              nodeId: desc.id,
              name: `${node.name}/${desc.name}`,
              storagePath: desc.metadata.storagePath,
              filePath: path.join(process.cwd(), 'download', desc.metadata.storagePath),
            });
          } else if (desc.type === 'note' && desc.note) {
            const noteContent = await db.noteContent.findUnique({ where: { nodeId: desc.id } });
            if (noteContent) {
              noteEntries.push({
                nodeId: desc.id,
                name: `${node.name}/${desc.name}.json`,
                contentJson: noteContent.contentJson,
              });
            }
          }
        }
      }
    }

    if (fileEntries.length === 0 && noteEntries.length === 0) {
      return NextResponse.json({ success: false, error: 'No downloadable content found' }, { status: 404 });
    }

    // Create ZIP archive using archiver with streaming
    const archive = archiver('zip', {
      zlib: { level: 6 }, // Compression level
    });

    // Add files to the archive
    for (const entry of fileEntries) {
      try {
        const fileStat = await stat(entry.filePath);
        if (fileStat.isFile()) {
          const fileBuffer = await readFile(entry.filePath);
          archive.append(fileBuffer, { name: entry.name });
        }
      } catch {
        // Skip files that don't exist on disk
      }
    }

    // Add notes as JSON files
    for (const entry of noteEntries) {
      archive.append(entry.contentJson, { name: entry.name });
    }

    // Finalize the archive
    archive.finalize();

    // Convert the archive stream to a buffer for NextResponse
    // Next.js Response doesn't natively support streaming Node.js Readable streams
    const chunks: Buffer[] = [];
    for await (const chunk of archive) {
      chunks.push(Buffer.from(chunk as ArrayBuffer));
    }
    const zipBuffer = Buffer.concat(chunks);

    // 18.4 — Stream ZIP response with proper headers
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="workspace-export.zip"',
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create download archive';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
