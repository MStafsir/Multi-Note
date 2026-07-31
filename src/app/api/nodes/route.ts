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
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';

// GET /api/nodes — List nodes in a folder (4.5)
async function handleGetNodes(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(session.user.id);

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId') || null;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const type = searchParams.get('type') || undefined;
    // MODUL 69: Sort parameters
    const sortByParam = searchParams.get('sortBy') || 'name';
    const sortDirectionParam = searchParams.get('sortDirection') || 'asc';
    const sortBy: 'name' | 'createdAt' = sortByParam === 'createdAt' ? 'createdAt' : 'name';
    const sortDirection: 'asc' | 'desc' = sortDirectionParam === 'desc' ? 'desc' : 'asc';

    // 4.5 — Return flat array with parent_id reference
    // Materialize tree in client using adjacency-list-to-tree algorithm
    // MODUL 49.12a — workspace scope: personal + workspace nodes
    const andConditions: Record<string, unknown>[] = [workspaceScopeFilter];

    if (parentId === null) {
      andConditions.push({ parentId: null });
    } else {
      andConditions.push({ parentId: parentId });
    }

    if (!includeDeleted) {
      andConditions.push({ deletedAt: null });
    }

    if (type && nodeTypeSchema.safeParse(type).success) {
      andConditions.push({ type: type });
    }

    // MODUL 69.5/69.8: Server-side sort with folder-first priority
    // Prisma doesn't support CASE WHEN in orderBy, so we use a two-step approach:
    // 1. Fetch with user's sort field + direction (no type clause)
    // 2. Post-sort in JS to enforce folder-first priority (constant, never flips)
    // 69.6: SQLite is case-insensitive by default for ORDER BY on text columns
    // 69.7: Use id as tiebreaker for consistent ordering
    const sortField = sortBy === 'createdAt' ? 'createdAt' : 'name';
    const orderByClause = [
      { [sortField]: sortDirection }, // User's sort field with direction
      { id: 'asc' as const }, // 69.7: Tiebreaker for consistent ordering
    ];

    const nodes = await db.node.findMany({
      where: { AND: andConditions },
      orderBy: orderByClause,
      include: {
        metadata: true,
        note: true,
      },
    });

    // Also get all nodes for tree building (flat array)
    // MODUL 49.12a — workspace scope for tree building
    const allNodesAndConditions: Record<string, unknown>[] = [workspaceScopeFilter];
    if (!includeDeleted) {
      allNodesAndConditions.push({ deletedAt: null });
    }

    const allNodes = await db.node.findMany({
      where: { AND: allNodesAndConditions },
      orderBy: orderByClause,
      include: {
        metadata: true,
        note: true,
      },
    });

    // 69.8: Post-sort to enforce folder-first priority (CONSTANT, never flips)
    // Folders (type='folder') always appear first, regardless of sort direction
    // Within each group (folders / non-folders), the server sort order is preserved
    const sortWithFolderPriority = <T extends { type: string }>(items: T[]): T[] => {
      const folders = items.filter(n => n.type === 'folder');
      const nonFolders = items.filter(n => n.type !== 'folder');
      return [...folders, ...nonFolders];
    };

    const sortedNodes = sortWithFolderPriority(nodes);
    const sortedAllNodes = sortWithFolderPriority(allNodes);

    logger.info('nodes_listed', { parentId, type, includeDeleted, count: nodes.length }, session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        nodes: sortedNodes.map(formatNode),
        allNodes: sortedAllNodes.map(formatNode),
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
    const workspaceIdFromBody = body.workspaceId || null; // MODUL 49.12a — workspaceId from request body

    if (nodeType === 'folder') {
      const validated = createFolderSchema.parse(body);

      // 4.1 — Check duplicate name in same parent scope
      // MODUL 49.12a — workspace-scoped duplicate check
      const { workspaceScopeFilter } = await getWorkspaceScopeFilter(session.user.id);
      const duplicate = await db.node.findFirst({
        where: {
          AND: [
            workspaceScopeFilter,
            { parentId: validated.parentId || null, name: validated.name, type: 'folder', deletedAt: null },
          ],
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
          workspaceId: workspaceIdFromBody, // MODUL 49.12a — workspaceId for created node
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
      // MODUL 49.12a — workspace-scoped duplicate check
      const { workspaceScopeFilter: noteScopeFilter } = await getWorkspaceScopeFilter(session.user.id);
      const duplicate = await db.node.findFirst({
        where: {
          AND: [
            noteScopeFilter,
            { parentId: validated.parentId || null, name: validated.name, type: 'note', deletedAt: null },
          ],
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
          workspaceId: workspaceIdFromBody, // MODUL 49.12a — workspaceId for created node
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
    scheduledDate: node.scheduledDate ?? null, // MODUL 78.1 — calendar entry date
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    deletedAt: node.deletedAt,
    metadata: metadata ? { ...metadata, sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null) } : null,
    content: node.note ? { nodeId: node.note.nodeId, contentJson: node.note.contentJson } : null,
  };
}

export const GET = traceHandler(handleGetNodes);
export const POST = traceHandler(handleCreateNode);
