// ============================================================
// MODUL 19: Activity Log — React Query Hooks
// ============================================================

import { useQuery } from '@tanstack/react-query';

// --- Query Keys ---
const ACTIVITY_KEYS = {
  all: ['activity'] as const,
  log: (nodeId?: string) => ['activity', 'log', nodeId ?? 'all'] as const,
  node: (nodeId: string) => ['activity', 'node', nodeId] as const,
};

// --- Activity Entry Type (from API response) ---
export interface ActivityEntry {
  id: string;
  actorId: string;
  actorName: string | null;
  actorEmail: string | null;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: string | null;
  actionType: string; // "create" | "rename" | "move" | "delete" | "restore" | "share" | "edit"
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// --- GET: Fetch activity entries (all or filtered by nodeId) ---
export function useActivityLog(nodeId?: string) {
  return useQuery({
    queryKey: ACTIVITY_KEYS.log(nodeId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (nodeId) params.set('nodeId', nodeId);
      params.set('limit', '50');
      params.set('offset', '0');

      const res = await fetch(`/api/activity?${params.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      return {
        entries: data.data.entries as ActivityEntry[],
        total: data.data.total as number,
      };
    },
    staleTime: 30000,
  });
}

// --- GET: Fetch activity for a specific node (dedicated endpoint) ---
export function useNodeActivity(nodeId: string | null) {
  return useQuery({
    queryKey: ACTIVITY_KEYS.node(nodeId ?? ''),
    queryFn: async () => {
      if (!nodeId) return { entries: [] as ActivityEntry[], total: 0 };

      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', '0');

      const res = await fetch(`/api/activity/${nodeId}?${params.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      return {
        entries: data.data.entries as ActivityEntry[],
        total: data.data.total as number,
      };
    },
    enabled: !!nodeId,
    staleTime: 30000,
  });
}

export { ACTIVITY_KEYS };
