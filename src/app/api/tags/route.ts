// ============================================================
// MODUL 21: Tag CRUD API Routes — Create & List Tags
// MODUL 27: Added traceHandler wrapper & structured logging
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';

// --- Zod Validators ---
const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100, 'Tag name too long'),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').default('#6B7280'),
});

// GET /api/tags — List all tags for current user
async function handleListTags(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tags = await db.tag.findMany({
      where: { ownerId: userId },
      orderBy: [{ name: 'asc' }],
    });

    logger.info('tags_listed', { count: tags.length }, userId);

    return NextResponse.json({
      success: true,
      data: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        colorHex: tag.colorHex,
      })),
    });
  } catch (error: unknown) {
    logger.error('tags_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tags';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/tags — Create a new tag
async function handleCreateTag(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createTagSchema.parse(body);

    // Check for duplicate tag name for this user
    const existing = await db.tag.findFirst({
      where: { ownerId: userId, name: validated.name },
    });

    if (existing) {
      logger.info('tag_create_duplicate', { name: validated.name }, userId);
      return NextResponse.json(
        { success: false, error: 'Tag with this name already exists' },
        { status: 409 }
      );
    }

    const tag = await db.tag.create({
      data: {
        ownerId: userId,
        name: validated.name,
        colorHex: validated.colorHex,
      },
    });

    logger.info('tag_created', { tagId: tag.id, name: validated.name }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: tag.id,
        name: tag.name,
        colorHex: tag.colorHex,
      },
    });
  } catch (error: unknown) {
    logger.error('tag_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create tag';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const GET = traceHandler(handleListTags);
export const POST = traceHandler(handleCreateTag);
