// ============================================================
// MODUL 33: Template CRUD API — Get, Update, Delete
// GET: Get single template details
// PATCH: Update a template (only owner can update)
// DELETE: Delete a template (only owner can delete, system templates cannot be deleted)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateTemplateSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import type { NoteTemplateInfo } from '@/types';

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

// GET /api/templates/[id] — Get single template details
async function handleGetTemplate(
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

    const template = await db.noteTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // Only allow viewing system templates or own templates
    if (template.ownerId !== null && template.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    logger.info('template_get', { templateId: id }, userId);

    return NextResponse.json({
      success: true,
      data: formatTemplate(template),
    });
  } catch (error: unknown) {
    logger.error('template_get_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch template';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/templates/[id] — Update a template (only owner can update, system templates cannot be updated)
async function handleUpdateTemplate(
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

    const template = await db.noteTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // System templates (ownerId=null) cannot be edited by users
    if (template.ownerId === null) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be edited' },
        { status: 403 }
      );
    }

    // Only owner can update their templates
    if (template.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Only the owner can edit this template' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateTemplateSchema.parse(body);

    const updated = await db.noteTemplate.update({
      where: { id },
      data: {
        ...(validated.title && { title: validated.title }),
        ...(validated.contentJsonTemplate && { contentJsonTemplate: validated.contentJsonTemplate }),
        ...(validated.category && { category: validated.category }),
      },
    });

    logger.info('template_updated', { templateId: id }, userId);

    return NextResponse.json({
      success: true,
      data: formatTemplate(updated),
    });
  } catch (error: unknown) {
    logger.error('template_update_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to update template';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// DELETE /api/templates/[id] — Delete a template (only owner can delete, system templates cannot be deleted)
async function handleDeleteTemplate(
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

    const template = await db.noteTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // System templates (ownerId=null) cannot be deleted by users
    if (template.ownerId === null) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be deleted' },
        { status: 403 }
      );
    }

    // Only owner can delete their templates
    if (template.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Only the owner can delete this template' }, { status: 403 });
    }

    await db.noteTemplate.delete({
      where: { id },
    });

    logger.info('template_deleted', { templateId: id }, userId);

    return NextResponse.json({
      success: true,
      data: { deletedId: id },
    });
  } catch (error: unknown) {
    logger.error('template_delete_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleGetTemplate, true);
export const PATCH = traceHandler(handleUpdateTemplate, true);
export const DELETE = traceHandler(handleDeleteTemplate, true);
