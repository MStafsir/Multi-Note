// ============================================================
// MODUL 33.4: Save as Template API — Convert note → template
// POST /api/nodes/[id]/save-as-template
// Deep-copies content_json to template, strips specific data,
// optionally strips embedded file references
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveAsTemplateSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { logActivity } from '@/lib/activity-logger';
import type { NoteTemplateInfo } from '@/types';

const EMBEDDED_FILE_NODE_TYPE = 'embeddedFile';
const DATABASE_BLOCK_NODE_TYPE = 'databaseBlock';

// Walk the ProseMirror JSON tree and strip embedded files and database blocks for template
function stripTemplateContent(
  node: Record<string, unknown>,
  stripEmbeddedFiles: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...node };

  // 33.4 — Strip embedded file nodes from template content
  // Replace with placeholder text if stripping
  if (node.type === EMBEDDED_FILE_NODE_TYPE && stripEmbeddedFiles) {
    const attrs = node.attrs as Record<string, string> || {};
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: `[File reference: ${attrs.fileName || 'embedded file'}]` }],
    };
  }

  // 33.4 — Keep embedded file references intact if not stripping
  // These references still point to original files — template user will see them
  // (Template user may not have access to original files, but that's expected)

  // 33.4 — Database blocks in templates: replace with placeholder text
  // Templates should not contain live database references — they should only hold structure
  if (node.type === DATABASE_BLOCK_NODE_TYPE) {
    const attrs = node.attrs as Record<string, string> || {};
    const dbTitle = attrs.database_id || 'database';
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: `[Database block placeholder — create a new database when using this template]` }],
    };
  }

  // Walk content array recursively
  if (node.content && Array.isArray(node.content)) {
    result.content = (node.content as Record<string, unknown>[]).map(child =>
      stripTemplateContent(child, stripEmbeddedFiles)
    );
  }

  return result;
}

// Helper: Format template for API response
function formatTemplate(t: Record<string, unknown>): NoteTemplateInfo {
  return {
    id: t.id as string,
    ownerId: t.ownerId as string | null,
    title: t.title as string,
    contentJsonTemplate: t.contentJsonTemplate as string,
    category: t.category as NoteTemplateInfo['category'],
    createdAt: t.createdAt as string,
    updatedAt: t.updatedAt as string,
  };
}

// POST /api/nodes/[id]/save-as-template — Convert note to template
async function handleSaveAsTemplate(
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
    const validated = saveAsTemplateSchema.parse({
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

    // Verify ownership
    if (sourceNode.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the owner can save this note as template' },
        { status: 403 }
      );
    }

    if (sourceNode.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Cannot save a deleted note as template' },
        { status: 400 }
      );
    }

    // Get source note content
    if (!sourceNode.note) {
      return NextResponse.json(
        { success: false, error: 'Note has no content to save as template' },
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

    // 33.4 — Strip specific data from content for template use
    // - Database blocks are always replaced with placeholders (templates should not have live db refs)
    // - Embedded files are optionally stripped based on toggle
    const templateContent = stripTemplateContent(parsedContent, validated.stripEmbeddedFiles);

    // Create the template entry
    const template = await db.noteTemplate.create({
      data: {
        ownerId: userId,
        title: validated.title,
        contentJsonTemplate: JSON.stringify(templateContent),
        category: validated.category,
      },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId: validated.nodeId,
      actionType: 'edit',
      metadata: {
        type: 'save_as_template',
        templateId: template.id,
        templateTitle: validated.title,
        category: validated.category,
        stripEmbeddedFiles: validated.stripEmbeddedFiles,
      },
    });

    logger.info('note_saved_as_template', {
      nodeId: validated.nodeId,
      templateId: template.id,
      category: validated.category,
      stripEmbeddedFiles: validated.stripEmbeddedFiles,
    }, userId);

    return NextResponse.json({
      success: true,
      data: formatTemplate(template),
    });
  } catch (error: unknown) {
    logger.error('note_save_as_template_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to save as template';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const POST = traceHandler(handleSaveAsTemplate, true);
