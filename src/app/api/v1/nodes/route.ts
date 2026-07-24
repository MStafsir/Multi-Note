// ============================================================
// MODUL 43.2: Public API v1 — List Nodes
// API key authentication (x-api-key header), scope >= read_only
// If workspaceId on key → list workspace nodes
// If personal key → list personal nodes (workspace_id null)
// Pagination: ?limit=50&offset=0
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';
import { logger } from '@/lib/logger';
import { authenticateApiKey, hasScope } from '@/lib/api-key-auth';

// GET /api/v1/nodes — List nodes (43.2)
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Authenticate via API key header
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Missing x-api-key header' }, { status: 401 });
    }

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Invalid or revoked API key' }, { status: 401 });
    }

    // Check scope: at least read_only
    if (!hasScope(authResult.scopes, 'read_only')) {
      return NextResponse.json({ success: false, error: 'Insufficient scope — requires read_only or higher' }, { status: 403 });
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Determine which nodes to list based on key type
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (authResult.workspaceId) {
      // Workspace key → list workspace nodes
      where.workspaceId = authResult.workspaceId;
    } else if (authResult.userId) {
      // Personal key → list personal nodes (workspace_id null)
      where.ownerId = authResult.userId;
      where.workspaceId = null;
    }

    // Optional type filter
    const type = searchParams.get('type');
    if (type && ['file', 'folder', 'note'].includes(type)) {
      where.type = type;
    }

    const nodes = await db.node.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
      skip: offset,
      include: {
        metadata: true,
        note: true,
      },
    });

    // Total count for pagination metadata
    const total = await db.node.count({ where });

    logger.info('v1_nodes_listed', {
      userId: authResult.userId,
      workspaceId: authResult.workspaceId,
      limit,
      offset,
      count: nodes.length,
      total,
    });

    return NextResponse.json({
      success: true,
      data: {
        nodes: nodes.map(node => formatNode(node)),
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + nodes.length < total,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('v1_nodes_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list nodes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Helper: Format node for API v1 response
function formatNode(node: Record<string, unknown>) {
  const metadata = node.metadata as Record<string, unknown> | null;
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    parentId: node.parentId,
    ownerId: node.ownerId,
    workspaceId: node.workspaceId,
    isFavorite: node.isFavorite,
    createdAt: (node.createdAt as Date).toISOString(),
    updatedAt: (node.updatedAt as Date).toISOString(),
    metadata: metadata ? {
      nodeId: metadata.nodeId,
      mimeType: metadata.mimeType,
      sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null),
      checksumSha256: metadata.checksumSha256,
    } : null,
  };
}
