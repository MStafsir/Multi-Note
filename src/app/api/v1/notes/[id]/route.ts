// ============================================================
// MODUL 43.2: Public API v1 — Single Note Detail
// GET: Read note content (scope >= read_only)
// PATCH: Update note content (scope >= read_write)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticateApiKey, hasScope } from '@/lib/api-key-auth';
import { logActivity } from '@/lib/activity-logger';
import { dispatchWebhooks } from '@/lib/webhook-dispatch';
import { checkNodeAccess } from '@/lib/permissions';
import { z } from 'zod';

// Update note content schema
const updateNoteApiSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contentJson: z.string().min(1, 'Content is required').optional(),
});

// GET /api/v1/notes/[id] — Read note content (43.2)
export async function GET(request: Request, context: unknown): Promise<NextResponse> {
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

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: nodeId } = await ctx.params;

    const node = await db.node.findUnique({
      where: { id: nodeId },
      include: { note: true },
    });

    if (!node || node.deletedAt || node.type !== 'note') {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }

    // Verify access
    if (authResult.workspaceId) {
      if (node.workspaceId !== authResult.workspaceId) {
        return NextResponse.json({ success: false, error: 'Note not accessible with this API key' }, { status: 403 });
      }
    } else if (authResult.userId) {
      const accessResult = await checkNodeAccess(authResult.userId, nodeId, 'view');
      if (!accessResult.hasAccess) {
        return NextResponse.json({ success: false, error: 'Note not accessible with this API key' }, { status: 403 });
      }
    }

    logger.info('v1_note_read', { nodeId }, authResult.userId);

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
    logger.error('v1_note_read_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to read note';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/v1/notes/[id] — Update note content (43.2)
export async function PATCH(request: Request, context: unknown): Promise<NextResponse> {
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

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: nodeId } = await ctx.params;

    const node = await db.node.findUnique({
      where: { id: nodeId },
      include: { note: true },
    });

    if (!node || node.deletedAt || node.type !== 'note') {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }

    // Verify access
    if (authResult.workspaceId) {
      if (node.workspaceId !== authResult.workspaceId) {
        return NextResponse.json({ success: false, error: 'Note not accessible with this API key' }, { status: 403 });
      }
    } else if (authResult.userId) {
      const accessResult = await checkNodeAccess(authResult.userId!, nodeId, 'edit');
      if (!accessResult.hasAccess) {
        return NextResponse.json({ success: false, error: 'Note not accessible with this API key' }, { status: 403 });
      }
    }

    const body = await request.json();
    const validated = updateNoteApiSchema.parse(body);

    // Update note content if provided
    if (validated.contentJson && node.note) {
      // Create a revision snapshot before updating
      const latestRevision = await db.noteRevision.findFirst({
        where: { nodeId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });

      const newRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

      await db.noteRevision.create({
        data: {
          nodeId,
          contentJsonSnapshot: node.note.contentJson,
          revisionNumber: newRevisionNumber,
          triggerType: 'manual',
        },
      });

      // Update the note content
      await db.noteContent.update({
        where: { nodeId },
        data: { contentJson: validated.contentJson },
      });
    }

    // Update node name if provided
    if (validated.name) {
      await db.node.update({
        where: { id: nodeId },
        data: { name: validated.name, updatedAt: new Date() },
      });
    }

    // Log activity
    await logActivity({
      actorId: userId,
      nodeId,
      actionType: 'edit',
      metadata: { type: 'note', source: 'api_v1', updatedFields: Object.keys(validated) },
    });

    // Dispatch webhooks
    await dispatchWebhooks('note.updated', nodeId, {
      name: validated.name || node.name,
      ownerId: userId,
      workspaceId: node.workspaceId,
    });

    // Fetch updated node
    const updatedNode = await db.node.findUnique({
      where: { id: nodeId },
      include: { note: true },
    });

    logger.info('v1_note_updated', { nodeId, updatedFields: Object.keys(validated) }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedNode!.id,
        type: updatedNode!.type,
        name: updatedNode!.name,
        parentId: updatedNode!.parentId,
        ownerId: updatedNode!.ownerId,
        workspaceId: updatedNode!.workspaceId,
        createdAt: updatedNode!.createdAt.toISOString(),
        updatedAt: updatedNode!.updatedAt.toISOString(),
        content: updatedNode!.note ? {
          nodeId: updatedNode!.note.nodeId,
          contentJson: updatedNode!.note.contentJson,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('v1_note_update_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to update note';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
