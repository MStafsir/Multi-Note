// ============================================================
// Module 28: Data Import API Route
// POST endpoint: Accepts ZIP file upload, extracts contents,
// creates nodes for files, notes (.md → Tiptap JSON), and folders
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { markdownToTiptap } from '@/lib/md-to-tiptap';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import unzipper from 'unzipper';

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

    // Parse multipart form data
    const formData = await request.formData();
    const zipFile = formData.get('file') as File | null;
    const targetParentId = (formData.get('parentId') as string) || null;

    if (!zipFile) {
      return NextResponse.json({ success: false, error: 'No ZIP file provided' }, { status: 400 });
    }

    // Validate file is a ZIP
    if (!zipFile.name.endsWith('.zip') && zipFile.type !== 'application/zip' && zipFile.type !== 'application/x-zip-compressed') {
      return NextResponse.json({ success: false, error: 'File must be a ZIP archive' }, { status: 400 });
    }

    // Validate target parent folder exists and belongs to user (if specified)
    if (targetParentId) {
      const parent = await db.node.findFirst({
        where: {
          id: targetParentId,
          ownerId: userId,
          type: 'folder',
          deletedAt: null,
        },
      });
      if (!parent) {
        return NextResponse.json({ success: false, error: 'Target folder not found' }, { status: 404 });
      }
    }

    // Read the ZIP file
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'download', 'uploads', userId);
    await mkdir(uploadDir, { recursive: true });

    // Track import statistics
    let importedFolders = 0;
    let importedFiles = 0;
    let importedNotes = 0;

    // Extract ZIP and process entries
    const directory = await unzipper.Open.buffer(zipBuffer);
    const entries = directory.files;

    // Sort entries: directories first, then files (depth-first order)
    const sortedEntries = [...entries].sort((a, b) => {
      // Directories before files
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      // Then by path (shorter paths first for proper nesting)
      return a.path.localeCompare(b.path);
    });

    // Map: relative path → nodeId (for building hierarchy)
    const pathToNodeId = new Map<string, string>();

    // Process each entry
    for (const entry of sortedEntries) {
      const entryPath = entry.path;
      const isDirectory = entry.type === 'directory';

      // Skip export-metadata.json (our own export metadata file)
      if (entryPath === 'export-metadata.json' || entryPath.startsWith('export-metadata.json/')) {
        continue;
      }

      // Determine the parent path for this entry
      const pathParts = entryPath.split('/');
      const entryName = pathParts[pathParts.length - 1];
      const parentPathParts = pathParts.slice(0, -1);

      // Find parent node ID
      let currentParentId: string | null = targetParentId;

      // Walk through parent path segments to find the parentId
      for (let i = 0; i < parentPathParts.length; i++) {
        const partialPath = parentPathParts.slice(0, i + 1).join('/');
        const existingNodeId = pathToNodeId.get(partialPath);
        if (existingNodeId) {
          currentParentId = existingNodeId;
        } else {
          // Parent folder hasn't been created yet — this shouldn't happen due to sorting
          // But as fallback, create it now
          const folderName = parentPathParts[i];
          const folderNode = await db.node.create({
            data: {
              ownerId: userId,
              parentId: currentParentId,
              type: 'folder',
              name: folderName,
            },
          });
          pathToNodeId.set(partialPath, folderNode.id);
          currentParentId = folderNode.id;
          importedFolders++;
        }
      }

      if (isDirectory) {
        // Create folder node
        const folderNode = await db.node.create({
          data: {
            ownerId: userId,
            parentId: currentParentId,
            type: 'folder',
            name: entryName,
          },
        });
        pathToNodeId.set(entryPath, folderNode.id);
        importedFolders++;
      } else {
        // Determine if this is a Markdown note or a regular file
        const isMarkdown = entryName.endsWith('.md') || entryName.endsWith('.markdown');

        if (isMarkdown) {
          // Read the Markdown content
          const contentBuffer = await entry.buffer();
          const mdContent = contentBuffer.toString('utf-8');

          // Convert Markdown to Tiptap ProseMirror JSON
          const tiptapJson = markdownToTiptap(mdContent);

          // Create note node (without the .md extension)
          const noteName = entryName.replace(/\.(md|markdown)$/, '');

          const noteNode = await db.node.create({
            data: {
              ownerId: userId,
              parentId: currentParentId,
              type: 'note',
              name: noteName,
              note: {
                create: {
                  contentJson: tiptapJson,
                },
              },
            },
          });

          pathToNodeId.set(entryPath, noteNode.id);
          importedNotes++;
        } else {
          // Regular file — save to storage and create file node
          const contentBuffer = await entry.buffer();
          const fileSize = contentBuffer.length;

          // Skip empty files
          if (fileSize === 0) continue;

          // Generate unique filename for storage
          const ext = path.extname(entryName);
          const baseName = path.basename(entryName, ext);
          const uniqueName = `${baseName}-${crypto.randomBytes(8).toString('hex')}${ext}`;
          const storageFilePath = path.join(uploadDir, uniqueName);
          const relativeStoragePath = `uploads/${userId}/${uniqueName}`;

          // Write file to disk
          await writeFile(storageFilePath, contentBuffer);

          // Calculate checksum
          const checksum = crypto.createHash('sha256').update(contentBuffer).digest('hex');

          // Determine MIME type
          const mimeType = getMimeType(entryName, entry);

          // Create file node with metadata
          const fileNode = await db.node.create({
            data: {
              ownerId: userId,
              parentId: currentParentId,
              type: 'file',
              name: entryName,
              metadata: {
                create: {
                  storagePath: relativeStoragePath,
                  mimeType,
                  sizeBytes: fileSize,
                  checksumSha256: checksum,
                },
              },
              versions: {
                create: {
                  storagePath: relativeStoragePath,
                  versionNumber: 1,
                  sizeBytes: fileSize,
                  checksumSha256: checksum,
                  createdById: userId,
                },
              },
            },
          });

          pathToNodeId.set(entryPath, fileNode.id);
          importedFiles++;
        }
      }
    }

    // Update storage quota for imported files
    const totalImportedSize = await db.node.aggregate({
      where: {
        ownerId: userId,
        type: 'file',
        deletedAt: null,
      },
      _sum: {
        id: true,
      },
    });

    // Log import activity
    await db.activityLog.create({
      data: {
        actorId: userId,
        actionType: 'create',
        metadata: JSON.stringify({
          type: 'import',
          folders: importedFolders,
          files: importedFiles,
          notes: importedNotes,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        imported: {
          folders: importedFolders,
          files: importedFiles,
          notes: importedNotes,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function getMimeType(fileName: string, _entry: unzipper.File): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java-source',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++src',
    '.h': 'text/x-c',
    '.sh': 'text/x-shellscript',
    '.xml': 'text/xml',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
  };
  return mimeMap[ext] || 'application/octet-stream';
}
