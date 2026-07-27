// ============================================================
// MODUL 33.3+33.5: Duplicate Note API — Deep-copy with options
// POST /api/nodes/[id]/duplicate
// Deep-copies content_json, handles embedded file references,
// and database blocks with copyDatabaseData toggle
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { duplicateNoteSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { logActivity } from '@/lib/activity-logger';
import { checkNodeAccess } from '@/lib/permissions';

// ProseMirror node types that are custom block references
const EMBEDDED_FILE_NODE_TYPE = 'embeddedFile';
const DATABASE_BLOCK_NODE_TYPE = 'databaseBlock';

// Walk the ProseMirror JSON tree and apply transformations
function walkProseMirrorTree(
  node: Record<string, unknown>,
  transformations: {
    onEmbeddedFile?: (attrs: Record<string, string>) => Record<string, unknown> | null;
    onDatabaseBlock?: (attrs: Record<string, string>, newDbId: string) => Record<string, unknown>;
    databaseIdMap: Map<string, string>;
  }
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...node };

  // Handle embeddedFile nodes — 33.3 + 33.4
  if (node.type === EMBEDDED_FILE_NODE_TYPE && transformations.onEmbeddedFile) {
    const attrs = node.attrs as Record<string, string> || {};
    const replacement = transformations.onEmbeddedFile(attrs);
    if (replacement === null) {
      // Strip: replace with a placeholder paragraph
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: `[Embedded file: ${attrs.fileName || 'file'} was removed]` }],
      };
    }
    result.attrs = replacement;
  }

  // Handle databaseBlock nodes — 33.5
  if (node.type === DATABASE_BLOCK_NODE_TYPE && node.attrs) {
    const attrs = node.attrs as Record<string, string>;
    const oldDbId = attrs.database_id as string;
    const newDbId = transformations.databaseIdMap.get(oldDbId);
    if (newDbId && transformations.onDatabaseBlock) {
      result.attrs = transformations.onDatabaseBlock(attrs, newDbId);
    }
  }

  // Walk content array recursively
  if (node.content && Array.isArray(node.content)) {
    result.content = (node.content as Record<string, unknown>[]).map(child =>
      walkProseMirrorTree(child, transformations)
    );
  }

  return result;
}

// POST /api/nodes/[id]/duplicate — Duplicate a note with options
async function handleDuplicateNote(
  request: Request,
  context: unknown
): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    const body = await request.json();
    const validated = duplicateNoteSchema.parse({
      nodeId: id,
      ...body,
    });

    // Find the source note node
    const sourceNode = await db.node.findUnique({
      where: { id: validated.nodeId },
      include: { note: true },
    });

    if (!sourceNode || sourceNode.type !== 'note') {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    // Verify view access (owner OR workspace member OR share recipient)
    const accessResult = await checkNodeAccess(userId, validated.nodeId, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied — you need view permission to duplicate this note' },
        { status: 403 }
      );
    }

    if (sourceNode.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Cannot duplicate a deleted note' },
        { status: 400 }
      );
    }

    // Get source note content
    if (!sourceNode.note) {
      return NextResponse.json(
        { success: false, error: 'Note has no content to duplicate' },
        { status: 400 }
      );
    }

    const sourceContentJson = sourceNode.note.contentJson;
    let parsedContent: Record<string, unknown>;

    try {
      parsedContent = JSON.parse(sourceContentJson);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid content JSON in source note' },
        { status: 400 }
      );
    }

    // Find all database blocks referenced in the source note's content
    // These are NoteDatabase records where parentNoteId = source note id
    const sourceDatabases = await db.noteDatabase.findMany({
      where: { parentNoteId: validated.nodeId },
      include: { rows: true },
    });

    // Map old database IDs to new database IDs
    const databaseIdMap = new Map<string, string>();

    // Create new databases for each source database
    for (const sourceDb of sourceDatabases) {
      const newDb = await db.noteDatabase.create({
        data: {
          parentNoteId: '', // Will update after creating the new note
          title: sourceDb.title,
          schema: sourceDb.schema, // Same schema (deep-copy)
        },
      });

      databaseIdMap.set(sourceDb.id, newDb.id);

      // 33.5 — Toggle: copy database data or schema only
      if (validated.copyDatabaseData) {
        // Copy all rows with new IDs
        for (const row of sourceDb.rows) {
          await db.databaseRow.create({
            data: {
              databaseId: newDb.id,
              cellData: row.cellData, // Same cell data
            },
          });
        }
      }
      // If copyDatabaseData=false: new database has 0 rows (schema only)

      // Copy views for each database
      const sourceViews = await db.databaseView.findMany({
        where: { databaseId: sourceDb.id },
      });

      for (const sourceView of sourceViews) {
        await db.databaseView.create({
          data: {
            databaseId: newDb.id,
            type: sourceView.type,
            name: sourceView.name,
            config: sourceView.config,
          },
        });
      }
    }

    // Build transformations for walking the ProseMirror tree
    const transformations = {
      // 33.4 — Embedded file references: keep pointing to original (no physical copy)
      // If stripEmbeddedFiles=true, replace with placeholder text
      onEmbeddedFile: validated.stripEmbeddedFiles
        ? (() => null) // Strip: return null → replaced with placeholder paragraph
        : (() => null as unknown as Record<string, string>), // Keep: return attrs unchanged (we handle this differently)
      onDatabaseBlock: (attrs: Record<string, string>, newDbId: string) => ({
        ...attrs,
        database_id: newDbId,
      }),
      databaseIdMap,
    };

    // Walk the content tree and apply transformations
    let deepCopiedContent = walkProseMirrorTree(parsedContent, {
      ...transformations,
      onEmbeddedFile: validated.stripEmbeddedFiles
        ? () => null // Replace with placeholder paragraph
        : (attrs: Record<string, string>) => attrs, // Keep original file reference
    });

    // Create the new note node (deep copy)
    const duplicateName = `${sourceNode.name} (Copy)`;

    // Check for duplicate name in same parent scope
    const existingDuplicate = await db.node.findFirst({
      where: {
        ownerId: userId,
        workspaceId: sourceNode.workspaceId,
        parentId: sourceNode.parentId || null,
        name: duplicateName,
        type: 'note',
        deletedAt: null,
      },
    });

    let finalName = duplicateName;
    if (existingDuplicate) {
      // Append a number to avoid collision
      let counter = 2;
      while (true) {
        const testName = `${sourceNode.name} (Copy ${counter})`;
        const existing = await db.node.findFirst({
          where: {
            ownerId: userId,
            workspaceId: sourceNode.workspaceId,
            parentId: sourceNode.parentId || null,
            name: testName,
            type: 'note',
            deletedAt: null,
          },
        });
        if (!existing) {
          finalName = testName;
          break;
        }
        counter++;
      }
    }

    // Create new Node + NoteContent
    const newNoteNode = await db.node.create({
      data: {
        ownerId: userId,
        workspaceId: sourceNode.workspaceId,
        parentId: sourceNode.parentId || null,
        type: 'note',
        name: finalName,
        note: {
          create: {
            contentJson: JSON.stringify(deepCopiedContent),
          },
        },
      },
      include: { metadata: true, note: true },
    });

    // Update database parentNoteId references to point to the new note
    for (const [oldDbId, newDbId] of databaseIdMap.entries()) {
      await db.noteDatabase.update({
        where: { id: newDbId },
        data: { parentNoteId: newNoteNode.id },
      });
    }

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId: newNoteNode.id,
      actionType: 'create',
      metadata: {
        type: 'note',
        name: finalName,
        duplicatedFrom: validated.nodeId,
        copyDatabaseData: validated.copyDatabaseData,
        stripEmbeddedFiles: validated.stripEmbeddedFiles,
      },
    });

    logger.info('note_duplicated', {
      sourceNodeId: validated.nodeId,
      newNodeId: newNoteNode.id,
      copyDatabaseData: validated.copyDatabaseData,
      stripEmbeddedFiles: validated.stripEmbeddedFiles,
    }, userId);

    // Format response
    const metadata = newNoteNode.metadata as Record<string, unknown> | null;
    return NextResponse.json({
      success: true,
      data: {
        id: newNoteNode.id,
        type: newNoteNode.type,
        name: newNoteNode.name,
        parentId: newNoteNode.parentId,
        ownerId: newNoteNode.ownerId,
        createdAt: newNoteNode.createdAt,
        updatedAt: newNoteNode.updatedAt,
        deletedAt: newNoteNode.deletedAt,
        metadata: metadata ? { ...metadata } : null,
        content: newNoteNode.note ? {
          nodeId: newNoteNode.note.nodeId,
          contentJson: newNoteNode.note.contentJson,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('note_duplicate_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to duplicate note';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const POST = traceHandler(handleDuplicateNote, true);
