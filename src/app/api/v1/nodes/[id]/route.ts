// ============================================================
// MODUL 43.2: Public API v1 — Get Single Node Detail
// API key auth, scope >= read_only
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { logger } from '@/lib/logger';
import { authenticateApiKey, hasScope } from '@/lib/api-key-auth';

// GET /api/v1/nodes/[id] — Get single node detail (43.2)
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
      include: {
        metadata: true,
        note: true,
      },
    });

    if (!node || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Verify the API key has access to this node
    if (authResult.workspaceId) {
      // Workspace key → node must belong to that workspace
      if (node.workspaceId !== authResult.workspaceId) {
        return NextResponse.json({ success: false, error: 'Node not accessible with this API key' }, { status: 403 });
      }
    } else if (authResult.userId) {
      // Personal key → node must be owned by that user
      if (node.ownerId !== authResult.userId) {
        return NextResponse.json({ success: false, error: 'Node not accessible with this API key' }, { status: 403 });
      }
    }

    logger.info('v1_node_detail', { nodeId }, authResult.userId);

    const metadata = node.metadata as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        workspaceId: node.workspaceId,
        isFavorite: node.isFavorite,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
        metadata: metadata ? {
          nodeId: metadata.nodeId,
          mimeType: metadata.mimeType,
          sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null),
          checksumSha256: metadata.checksumSha256,
        } : null,
        content: node.note ? {
          nodeId: node.note.nodeId,
          contentJson: node.note.contentJson,
        } : null,
      },
    });
  } catch (error: unknown) {
    logger.error('v1_node_detail_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to get node detail';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
