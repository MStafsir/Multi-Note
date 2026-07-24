// ============================================================
// MODUL 43: API Keys — List & Generate API Key Routes
// 43.1 — GET: List user's API keys (authenticated)
// 43.1 — POST: Generate new API key (authenticated)
// Key plaintext shown ONLY once at creation, stored as SHA-256 hash
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { z } from 'zod';
import crypto from 'crypto';
import type { ApiKeyScope } from '@/types';

// 43.1 — API key creation schema
const createApiKeySchema = z.object({
  scopes: z.array(z.enum(['read_only', 'read_write', 'admin'])).min(1, 'At least one scope is required'),
  workspaceId: z.string().optional(),
});

// GET /api/api-keys — List user's API keys (43.1)
async function handleListApiKeys(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeys = await db.apiKey.findMany({
      where: {
        ownerId: userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('api_keys_listed', { count: apiKeys.length }, userId);

    return NextResponse.json({
      success: true,
      data: apiKeys.map(key => ({
        id: key.id,
        ownerId: key.ownerId,
        workspaceId: key.workspaceId,
        keyPrefix: key.keyPrefix,
        scopes: JSON.parse(key.scopes) as ApiKeyScope[],
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        revokedAt: key.revokedAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    logger.error('api_keys_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list API keys';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/api-keys — Generate new API key (43.1)
async function handleCreateApiKey(request: Request): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createApiKeySchema.parse(body);

    // If workspaceId provided, verify user has access
    if (validated.workspaceId) {
      const membership = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: validated.workspaceId, userId } },
        select: { role: true },
      });

      const workspace = await db.workspace.findUnique({
        where: { id: validated.workspaceId },
        select: { ownerId: true },
      });

      if (!workspace || (workspace.ownerId !== userId && !membership)) {
        return NextResponse.json({ success: false, error: 'No access to this workspace' }, { status: 403 });
      }

      // Only owner/admin can create workspace-level API keys
      if (workspace.ownerId !== userId && membership?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Only workspace owner or admin can create workspace API keys' }, { status: 403 });
      }
    }

    // Generate random key: uw_{uuid_without_dashes}
    const rawKey = `uw_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Store as SHA-256 hash, NOT plaintext (43.1 security)
    const apiKey = await db.apiKey.create({
      data: {
        ownerId: userId,
        workspaceId: validated.workspaceId || null,
        keyPrefix,
        keyHash,
        scopes: JSON.stringify(validated.scopes),
      },
    });

    logger.info('api_key_created', {
      keyPrefix,
      workspaceId: validated.workspaceId || null,
      scopes: validated.scopes,
    }, userId);

    // Return plaintext key — ONLY shown once at creation (43.1)
    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        ownerId: apiKey.ownerId,
        workspaceId: apiKey.workspaceId,
        keyPrefix: apiKey.keyPrefix,
        key: rawKey, // Plaintext key — only returned on creation
        scopes: JSON.parse(apiKey.scopes) as ApiKeyScope[],
        lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
        revokedAt: apiKey.revokedAt?.toISOString() ?? null,
        createdAt: apiKey.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('api_key_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create API key';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleListApiKeys);
export const POST = traceHandler(handleCreateApiKey);
