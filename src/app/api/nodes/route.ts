// ============================================================
// MODUL 4: Node CRUD API Routes — Create & List
// MODUL 27: Added traceHandler wrapper & structured logging
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createFolderSchema, getFolderTreeSchema, nodeTypeSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';

// GET /api/nodes — List nodes in a folder (4.5)
async function handleGetNodes(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId') || null;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const type = searchParams.get('type') || undefined;

    // 4.5 — Return flat array with parent_id reference
    // Materialize tree in client using adjacency-list-to-tree algorithm
    const where: Record<string, unknown> = {
      ownerId: session.user.id,
    };

    if (parentId === null) {
      where.parentId = null;
    } else {
      where.parentId = parentId;
    }

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (type && nodeTypeSchema.safeParse(type).success) {
      where.type = type;
    }

    const nodes = await db.node.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        metadata: true,
        note: true,
      },
    });

    // Also get all nodes for tree building (flat array)
    const allNodes = await db.node.findMany({
      where: {
        ownerId: session.user.id,
        deletedAt: includeDeleted ? undefined : null,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        metadata: true,
        note: true,
      },
    });

    logger.info('nodes_listed', { parentId, type, includeDeleted, count: nodes.length }, session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        nodes: nodes.map(formatNode),
        allNodes: allNodes.map(formatNode),
      },
    });
  } catch (error: unknown) {
    logger.error('nodes_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch nodes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/nodes — Create a folder/note (4.1)
async function handleCreateNode(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const nodeType = body.type || 'folder';

    if (nodeType === 'folder') {
      const validated = createFolderSchema.parse(body);

      // 4.1 — Check duplicate name in same parent scope
      const duplicate = await db.node.findFirst({
        where: {
          ownerId: session.user.id,
          parentId: validated.parentId || null,
          name: validated.name,
          type: 'folder',
          deletedAt: null,
        },
      });

      if (duplicate) {
        logger.info('node_create_duplicate', { type: 'folder', name: validated.name, parentId: validated.parentId }, session.user.id);
        return NextResponse.json(
          { success: false, error: 'Folder with this name already exists' },
          { status: 409 }
        );
      }

      const node = await db.node.create({
        data: {
          ownerId: session.user.id,
          parentId: validated.parentId || null,
          type: 'folder',
          name: validated.name,
        },
        include: { metadata: true, note: true },
      });

      // 19 — Log activity using shared logger
      await logActivity({ actorId: session.user.id, nodeId: node.id, actionType: 'create', metadata: { type: 'folder', name: validated.name } });

      logger.info('node_created', { type: 'folder', name: validated.name, nodeId: node.id }, session.user.id);

      return NextResponse.json({ success: true, data: formatNode(node) });
    }

    if (nodeType === 'note') {
      const validated = createFolderSchema.parse({ ...body, type: undefined });

      // Check duplicate
      const duplicate = await db.node.findFirst({
        where: {
          ownerId: session.user.id,
          parentId: validated.parentId || null,
          name: validated.name,
          type: 'note',
          deletedAt: null,
        },
      });

      if (duplicate) {
        logger.info('node_create_duplicate', { type: 'note', name: validated.name, parentId: validated.parentId }, session.user.id);
        return NextResponse.json(
          { success: false, error: 'Note with this name already exists' },
          { status: 409 }
        );
      }

      const node = await db.node.create({
        data: {
          ownerId: session.user.id,
          parentId: validated.parentId || null,
          type: 'note',
          name: validated.name,
          note: {
            create: {
              contentJson: JSON.stringify({
                type: 'doc',
                content: [{ type: 'paragraph' }],
              }),
            },
          },
        },
        include: { metadata: true, note: true },
      });

      await logActivity({ actorId: session.user.id, nodeId: node.id, actionType: 'create', metadata: { type: 'note', name: validated.name } });

      logger.info('node_created', { type: 'note', name: validated.name, nodeId: node.id }, session.user.id);

      return NextResponse.json({ success: true, data: formatNode(node) });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid node type' },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error('node_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create node';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// Helper: Format node for API response
function formatNode(node: Record<string, unknown>) {
  const metadata = node.metadata as Record<string, unknown> | null;
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    parentId: node.parentId,
    ownerId: node.ownerId,
    isFavorite: node.isFavorite,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    deletedAt: node.deletedAt,
    metadata: metadata ? { ...metadata, sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null) } : null,
    content: node.note ? { nodeId: node.note.nodeId, contentJson: node.note.contentJson } : null,
  };
}

export const GET = traceHandler(handleGetNodes);
export const POST = traceHandler(handleCreateNode);
