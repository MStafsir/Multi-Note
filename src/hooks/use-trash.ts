'use client';

// ============================================================
// MODUL 17: React Query Hooks — Trash operations
// useTrashList: fetch trashed nodes
// useTrashRestore: mutation to restore a node
// useTrashPurge: mutation to empty trash (with confirmation)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NodeType } from '@/types';

// --- Query Keys ---
const TRASH_KEYS = {
  all: ['trash'] as const,
  list: ['trash', 'list'] as const,
};

// --- Trashed Node Type ---
export interface TrashedNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  ownerId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: {
    sizeBytes: number | null;
    mimeType: string | null;
  } | null;
}

// --- GET: Fetch trashed nodes ---
export function useTrashList() {
  return useQuery({
    queryKey: TRASH_KEYS.list,
    queryFn: async () => {
      const res = await fetch('/api/trash');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return (data.data.nodes || []) as TrashedNode[];
    },
    staleTime: 30000,
  });
}

// --- POST: Restore a node from trash ---
export function useTrashRestore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId }: { nodeId: string }) => {
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      const data = await res.json();

      if (!data.success) {
        // Check for quota error specifically
        if (res.status === 403 && data.error?.includes('quota')) {
          throw new Error('QUOTA_EXCEEDED');
        }
        throw new Error(data.error);
      }

      return data.data;
    },
    onSuccess: (data) => {
      // Invalidate both nodes and trash queries
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: TRASH_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['storage-quota'] });

      if (data.warning) {
        toast.success('Restored', { description: data.warning });
      } else {
        toast.success('Restored successfully');
      }
    },
    onError: (error) => {
      if (error.message === 'QUOTA_EXCEEDED') {
        toast.error('Cannot restore — this would exceed your storage quota');
      } else {
        toast.error(`Restore failed: ${error.message}`);
      }
    },
  });
}

// --- POST: Empty trash (purge all trashed items) ---
export function useTrashPurge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/trash/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          confirmText: 'I understand this is permanent',
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data;
    },
    onSuccess: (data) => {
      // Invalidate nodes, trash, and storage quota
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: TRASH_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['storage-quota'] });

      toast.success('Trash emptied', {
        description: `${data.deletedCount} items permanently deleted`,
      });
    },
    onError: (error) => {
      toast.error(`Failed to empty trash: ${error.message}`);
    },
  });
}
