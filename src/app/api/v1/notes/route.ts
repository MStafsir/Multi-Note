// ============================================================
// MODUL 43.2: Public API v1 — Notes CRUD
// POST: Create note via API (scope >= read_write)
// GET: List notes (scope >= read_only)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticateApiKey, hasScope } from '@/lib/api-key-auth';
import { logActivity } from '@/lib/activity-logger';
import { dispatchWebhooks } from '@/lib/webhook-dispatch';
import { z } from 'zod';

// Create note schema
const createNoteApiSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  parentId: z.string().nullable().optional(),
  contentJson: z.string().optional(), // optional at creation
});

// GET /api/v1/notes — List notes (43.2)
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Missing x-api-key header' }, { status: 401 });
    }

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Invalid or revoked API key' }, { status: 401 });
    }

    if (!hasScope(authResult.scopes, 'read_only')) {
      return NextResponse.json({ success: false, error: 'Insufficient scope — requires read_only or higher' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    const where: Record<string, unknown> = {
      type: 'note',
      deletedAt: null,
    };

    if (authResult.workspaceId) {
      where.workspaceId = authResult.workspaceId;
    } else if (authResult.userId) {
      where.ownerId = authResult.userId;
      where.workspaceId = null;
    }

    const notes = await db.node.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
      skip: offset,
      include: { note: true },
    });

    const total = await db.node.count({ where });

    logger.info('v1_notes_listed', {
      userId: authResult.userId,
      workspaceId: authResult.workspaceId,
      count: notes.length,
      total,
    });

    return NextResponse.json({
      success: true,
      data: {
        notes: notes.map(note => ({
          id: note.id,
          name: note.name,
          parentId: note.parentId,
          ownerId: note.ownerId,
          workspaceId: note.workspaceId,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
          contentPreview: note.note?.contentJson
            ? note.note.contentJson.substring(0, 200)
            : null,
        })),
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + notes.length < total,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('v1_notes_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list notes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/v1/notes — Create note via API (43.2)
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Missing x-api-key header' }, { status: 401 });
    }

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Invalid or revoked API key' }, { status: 401 });
    }

    if (!hasScope(authResult.scopes, 'read_write')) {
      return NextResponse.json({ success: false, error: 'Insufficient scope — requires read_write or higher' }, { status: 403 });
    }

    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'API key has no associated user' }, { status: 400 });
    }

    const body = await request.json();
    const validated = createNoteApiSchema.parse(body);

    // Determine workspace context
    const workspaceId = authResult.workspaceId || null;

    // Check duplicate name
    const duplicate = await db.node.findFirst({
      where: {
        ownerId: userId,
        parentId: validated.parentId || null,
        workspaceId,
        name: validated.name,
        type: 'note',
        deletedAt: null,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, error: 'Note with this name already exists' },
        { status: 409 }
      );
    }

    // Create note with optional initial content
    const initialContent = validated.contentJson || JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });

    const node = await db.node.create({
      data: {
        ownerId: userId,
        parentId: validated.parentId || null,
        workspaceId,
        type: 'note',
        name: validated.name,
        note: {
          create: {
            contentJson: initialContent,
          },
        },
      },
      include: { note: true },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId: node.id,
      actionType: 'create',
      metadata: { type: 'note', name: validated.name, source: 'api_v1' },
    });

    // Dispatch webhooks
    await dispatchWebhooks('node.created', node.id, {
      type: 'note',
      name: validated.name,
      ownerId: userId,
      workspaceId,
    });

    logger.info('v1_note_created', { nodeId: node.id, name: validated.name }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        workspaceId: node.workspaceId,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
        content: node.note ? {
          nodeId: node.note.nodeId,
          contentJson: node.note.contentJson,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('v1_note_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create note';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
