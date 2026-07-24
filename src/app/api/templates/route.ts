// ============================================================
// MODUL 33: Template CRUD API — List & Create
// GET: List templates (system + user's own), seed on first call
// POST: Create a new user template
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTemplateSchema } from '@/lib/validators';
import { systemTemplateSeeds } from '@/lib/template-seeds';
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

// Seed system templates if they don't exist yet
async function seedSystemTemplates(): Promise<void> {
  const existingSystemTemplates = await db.noteTemplate.findMany({
    where: { ownerId: null },
  });

  if (existingSystemTemplates.length === 0) {
    logger.info('seeding_system_templates', { count: systemTemplateSeeds.length }, null);

    for (const seed of systemTemplateSeeds) {
      await db.noteTemplate.create({
        data: {
          ownerId: null,
          title: seed.title,
          contentJsonTemplate: seed.contentJsonTemplate,
          category: seed.category,
        },
      });
    }
  }
}

// GET /api/templates — List templates (system + user's own)
async function handleGetTemplates(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Seed system templates on first GET call (33.2)
    await seedSystemTemplates();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Build where clause: system templates (ownerId=null) OR user's own templates
    const where: Record<string, unknown> = {
      OR: [
        { ownerId: null }, // System built-in
        { ownerId: userId }, // User's own
      ],
    };

    if (category) {
      // Wrap the OR inside AND with category filter
      where.OR = [
        { ownerId: null, category },
        { ownerId: userId, category },
      ];
    }

    let templates = await db.noteTemplate.findMany({
      where,
      orderBy: [
        { ownerId: 'asc' }, // System templates first (null sorts first in SQLite)
        { createdAt: 'asc' },
      ],
    });

    // Search filter by title (in-memory since SQLite doesn't have full-text on this)
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t =>
        (t.title as string).toLowerCase().includes(searchLower)
      );
    }

    logger.info('templates_listed', { category, search, count: templates.length }, userId);

    return NextResponse.json({
      success: true,
      data: templates.map(formatTemplate),
    });
  } catch (error: unknown) {
    logger.error('templates_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/templates — Create a new user template
async function handleCreateTemplate(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    const template = await db.noteTemplate.create({
      data: {
        ownerId: userId,
        title: validated.title,
        contentJsonTemplate: validated.contentJsonTemplate,
        category: validated.category,
      },
    });

    logger.info('template_created', { templateId: template.id, category: validated.category }, userId);

    return NextResponse.json({
      success: true,
      data: formatTemplate(template),
    });
  } catch (error: unknown) {
    logger.error('template_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create template';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const GET = traceHandler(handleGetTemplates);
export const POST = traceHandler(handleCreateTemplate);
