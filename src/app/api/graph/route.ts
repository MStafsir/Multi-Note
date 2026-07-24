// ============================================================
// MODUL 34.5: Graph API — GET force-directed graph data
// Returns { nodes: GraphNode[], edges: GraphEdge[] }
// Limits to top 200 nodes by connection count (backlink centrality)
// Supports ?limit=200&page=1 for "load more" pagination
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import type { GraphNode, GraphEdge } from '@/types';

// GET /api/graph — Get force-directed graph data for user's workspace
async function handleGetGraph(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Cap limit at 500 to prevent server overload
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const offset = (page - 1) * safeLimit;

    // 1. Get all NoteLink records where the source node belongs to the user
    const links = await db.noteLink.findMany({
      where: {
        sourceNode: {
          ownerId: userId,
          deletedAt: null,
        },
      },
      include: {
        sourceNode: {
          select: { id: true, name: true, deletedAt: true, ownerId: true },
        },
        targetNode: {
          select: { id: true, name: true, deletedAt: true, ownerId: true },
        },
      },
    });

    // Also get links where the target is the user's note (for incoming backlinks)
    const incomingLinks = await db.noteLink.findMany({
      where: {
        targetNode: {
          ownerId: userId,
          deletedAt: null,
        },
        sourceNode: {
          deletedAt: null,
        },
      },
      include: {
        sourceNode: {
          select: { id: true, name: true, deletedAt: true, ownerId: true },
        },
        targetNode: {
          select: { id: true, name: true, deletedAt: true, ownerId: true },
        },
      },
    });

    // 2. Build unique node set from all link endpoints
    const nodeMap = new Map<string, { name: string; backlinkCount: number; isDeleted: boolean; isOwner: boolean }>();

    // Count backlinks per node (number of links pointing TO this node)
    const backlinkCounts = new Map<string, number>();

    for (const link of links) {
      // Source node (user's own note)
      if (link.sourceNode && !link.sourceNode.deletedAt) {
        const existing = nodeMap.get(link.sourceNodeId);
        if (!existing) {
          nodeMap.set(link.sourceNodeId, {
            name: link.sourceNode.name,
            backlinkCount: 0,
            isDeleted: false,
            isOwner: link.sourceNode.ownerId === userId,
          });
        }
      }

      // Target node (referenced note)
      if (link.targetNode) {
        const isDeleted = link.targetNode.deletedAt !== null;
        const existing = nodeMap.get(link.targetNodeId);
        if (!existing) {
          nodeMap.set(link.targetNodeId, {
            name: link.targetNode.name,
            backlinkCount: 0,
            isDeleted,
            isOwner: link.targetNode.ownerId === userId,
          });
        }
        // Increment backlink count for target node
        if (!isDeleted) {
          backlinkCounts.set(
            link.targetNodeId,
            (backlinkCounts.get(link.targetNodeId) || 0) + 1
          );
        }
      }
    }

    for (const link of incomingLinks) {
      // Source node (someone else's note referencing user's note)
      if (link.sourceNode && !link.sourceNode.deletedAt) {
        const existing = nodeMap.get(link.sourceNodeId);
        if (!existing) {
          nodeMap.set(link.sourceNodeId, {
            name: link.sourceNode.name,
            backlinkCount: 0,
            isDeleted: false,
            isOwner: link.sourceNode.ownerId === userId,
          });
        }
      }

      // Target node (user's own note)
      if (link.targetNode && !link.targetNode.deletedAt) {
        const existing = nodeMap.get(link.targetNodeId);
        if (!existing) {
          nodeMap.set(link.targetNodeId, {
            name: link.targetNode.name,
            backlinkCount: 0,
            isDeleted: false,
            isOwner: link.targetNode.ownerId === userId,
          });
        }
        // Increment backlink count for target node
        backlinkCounts.set(
          link.targetNodeId,
          (backlinkCounts.get(link.targetNodeId) || 0) + 1
        );
      }
    }

    // 3. Update backlink counts in nodeMap
    for (const [nodeId, count] of backlinkCounts) {
      const nodeData = nodeMap.get(nodeId);
      if (nodeData) {
        nodeData.backlinkCount = count;
      }
    }

    // 4. Sort nodes by backlink count (centrality) — top 200
    const allNodes = Array.from(nodeMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        backlinkCount: data.backlinkCount,
        isDeleted: data.isDeleted,
        isOwner: data.isOwner,
      }))
      .sort((a, b) => b.backlinkCount - a.backlinkCount || a.name.localeCompare(b.name));

    // 5. Apply pagination limit
    const totalNodes = allNodes.length;
    const paginatedNodes = allNodes.slice(offset, offset + safeLimit);
    const paginatedNodeIds = new Set(paginatedNodes.map(n => n.id));

    // 6. Build edges — only include edges where both endpoints are in the paginated set
    const allEdges: GraphEdge[] = [];
    const seenEdges = new Set<string>();

    // Process outgoing links
    for (const link of links) {
      const sourceId = link.sourceNodeId;
      const targetId = link.targetNodeId;
      const edgeKey = `${sourceId}-${targetId}`;

      if (!seenEdges.has(edgeKey) && paginatedNodeIds.has(sourceId) && paginatedNodeIds.has(targetId)) {
        seenEdges.add(edgeKey);
        allEdges.push({
          source: sourceId,
          target: targetId,
        });
      }
    }

    // Process incoming links (may add edges from other users' notes)
    for (const link of incomingLinks) {
      const sourceId = link.sourceNodeId;
      const targetId = link.targetNodeId;
      const edgeKey = `${sourceId}-${targetId}`;

      if (!seenEdges.has(edgeKey) && paginatedNodeIds.has(sourceId) && paginatedNodeIds.has(targetId)) {
        seenEdges.add(edgeKey);
        allEdges.push({
          source: sourceId,
          target: targetId,
        });
      }
    }

    // 7. Build response with GraphNode format
    const graphNodes: GraphNode[] = paginatedNodes.map(n => ({
      id: n.id,
      name: n.name,
      backlinkCount: n.backlinkCount,
    }));

    // Extended node info for the frontend (deleted status, ownership)
    const extendedNodeInfo = paginatedNodes.map(n => ({
      id: n.id,
      name: n.name,
      backlinkCount: n.backlinkCount,
      isDeleted: n.isDeleted,
      isOwner: n.isOwner,
    }));

    logger.info('graph_data_fetched', {
      nodeCount: graphNodes.length,
      edgeCount: allEdges.length,
      totalNodes,
      limit: safeLimit,
      page,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        nodes: graphNodes,
        edges: allEdges,
        extendedNodeInfo,
        total: totalNodes,
        hasMore: offset + safeLimit < totalNodes,
      },
    });
  } catch (error: unknown) {
    logger.error('graph_fetch_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch graph data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = traceHandler(handleGetGraph);
