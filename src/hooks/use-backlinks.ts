// ============================================================
// MODUL 34: Backlink & Graph React Query Hooks
// useBacklinks(nodeId) — GET /api/nodes/[id]/backlinks
// useGraphData(page) — GET /api/graph?limit=200&page=N
// useNoteLinkExtractor — Utility for extracting links from Tiptap JSON
// ============================================================

'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { BacklinkInfo, GraphNode, GraphEdge } from '@/types';

// ============================================================
// Backlink response type (extended with broken link status)
// ============================================================

interface BacklinkData {
  backlinks: Array<BacklinkInfo & { accessRevoked?: boolean }>;
  total: number;
}

// ============================================================
// Graph response type (extended with pagination info)
// ============================================================

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  extendedNodeInfo: Array<{
    id: string;
    name: string;
    backlinkCount: number;
    isDeleted: boolean;
    isOwner: boolean;
  }>;
  total: number;
  hasMore: boolean;
}

// ============================================================
// useBacklinks — Fetch backlinks for a note
// ============================================================

export function useBacklinks(nodeId: string) {
  return useQuery<BacklinkData>({
    queryKey: ['backlinks', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}/backlinks`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch backlinks');
      }

      return data.data as BacklinkData;
    },
    enabled: !!nodeId,
    staleTime: 30000, // 30s stale time — backlinks don't change rapidly
    refetchOnWindowFocus: false,
  });
}

// ============================================================
// useGraphData — Fetch force-directed graph data with pagination
// ============================================================

export function useGraphData(page: number = 1) {
  const query = useQuery<GraphData>({
    queryKey: ['graph', page],
    queryFn: async () => {
      const res = await fetch(`/api/graph?limit=200&page=${page}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch graph data');
      }

      return data.data as GraphData;
    },
    staleTime: 60000, // 1min stale time — graph data is more stable
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    hasNextPage: query.data?.hasMore ?? false,
    fetchNextPage: () => page + 1, // Simplified: caller increments page
  };
}

// ============================================================
// useNoteLinkExtractor — Client-side utility for parsing Tiptap JSON
// Used for preview/validation before saving (not for server-side link creation)
// ============================================================

export function useNoteLinkExtractor() {
  /**
   * Extract NoteLinkMention nodes from Tiptap JSON content.
   * This is a client-side mirror of the server-side note-link-extractor.
   * Useful for preview/validation before saving.
   */
  const extractLinks = (contentJson: string): Array<{
    noteId: string;
    noteName: string;
  }> => {
    try {
      const parsed = JSON.parse(contentJson);
      if (!parsed || parsed.type !== 'doc') return [];

      const links: Array<{ noteId: string; noteName: string }> = [];
      walkTree(parsed, links);
      return links;
    } catch {
      return [];
    }
  };

  const walkTree = (
    node: Record<string, unknown>,
    links: Array<{ noteId: string; noteName: string }>
  ) => {
    if (!node) return;

    if (node.type === 'noteLinkMention') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      const noteId = attrs?.noteId as string | undefined;
      const noteName = attrs?.noteName as string | undefined;
      if (noteId && noteName) {
        links.push({ noteId, noteName });
      }
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content as Record<string, unknown>[]) {
        walkTree(child, links);
      }
    }
  };

  return { extractLinks };
}
