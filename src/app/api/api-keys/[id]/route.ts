// ============================================================
// MODUL 43: API Keys — Update & Revoke Routes
// 43.5 — PATCH: Update scopes (owner of key only)
// 43.5 — DELETE: Revoke API key — set revokedAt (immediate invalidation)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { z } from 'zod';
import type { ApiKeyScope } from '@/types';

// 43.5 — Update scopes schema
const updateApiKeySchema = z.object({
  scopes: z.array(z.enum(['read_only', 'read_write', 'admin'])).min(1, 'At least one scope required').optional(),
});

// PATCH /api/api-keys/[id] — Update API key scopes (43.5)
async function handleUpdateApiKey(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: apiKeyId } = await ctx.params;

    // Find the API key
    const apiKey = await db.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Only the owner of the key can update it
    if (apiKey.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Only the key owner can update scopes' }, { status: 403 });
    }

    // Cannot update revoked keys
    if (apiKey.revokedAt) {
      return NextResponse.json({ success: false, error: 'Cannot update revoked API key' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateApiKeySchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (validated.scopes) {
      updateData.scopes = JSON.stringify(validated.scopes);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const updatedKey = await db.apiKey.update({
      where: { id: apiKeyId },
      data: updateData,
    });

    logger.info('api_key_updated', { apiKeyId, scopes: validated.scopes }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedKey.id,
        ownerId: updatedKey.ownerId,
        workspaceId: updatedKey.workspaceId,
        keyPrefix: updatedKey.keyPrefix,
        scopes: JSON.parse(updatedKey.scopes) as ApiKeyScope[],
        lastUsedAt: updatedKey.lastUsedAt?.toISOString() ?? null,
        revokedAt: updatedKey.revokedAt?.toISOString() ?? null,
        createdAt: updatedKey.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('api_key_update_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to update API key';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/api-keys/[id] — Revoke API key (43.5 — immediate invalidation)
async function handleRevokeApiKey(request: Request, context: unknown): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = context as { params: Promise<{ id: string }> };
    const { id: apiKeyId } = await ctx.params;

    const apiKey = await db.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Only the owner of the key can revoke it
    if (apiKey.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — Only the key owner can revoke' }, { status: 403 });
    }

    // Already revoked
    if (apiKey.revokedAt) {
      return NextResponse.json({ success: false, error: 'API key is already revoked' }, { status: 400 });
    }

    // 43.5 — Immediate invalidation: set revokedAt to now
    const revokedKey = await db.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    logger.info('api_key_revoked', { apiKeyId, keyPrefix: apiKey.keyPrefix }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: revokedKey.id,
        ownerId: revokedKey.ownerId,
        workspaceId: revokedKey.workspaceId,
        keyPrefix: revokedKey.keyPrefix,
        scopes: JSON.parse(revokedKey.scopes) as ApiKeyScope[],
        lastUsedAt: revokedKey.lastUsedAt?.toISOString() ?? null,
        revokedAt: revokedKey.revokedAt!.toISOString(),
        createdAt: revokedKey.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('api_key_revoke_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to revoke API key';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const PATCH = traceHandler(handleUpdateApiKey, true);
export const DELETE = traceHandler(handleRevokeApiKey, true);
