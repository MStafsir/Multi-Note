// ============================================================
// MODUL 21: React Query Hooks — Tags, Favorites & Custom Metadata
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TagInfo, NodeTagInfo } from '@/types';

// --- Query Keys ---
const TAG_KEYS = {
  all: ['tags'] as const,
  list: () => ['tags', 'list'] as const,
  nodeTags: (nodeId: string) => ['tags', 'node', nodeId] as const,
};

const FAVORITE_KEYS = {
  all: ['favorites'] as const,
  list: () => ['favorites', 'list'] as const,
};

// --- GET: Fetch all user tags ---
export function useTags() {
  return useQuery({
    queryKey: TAG_KEYS.list(),
    queryFn: async () => {
      const res = await fetch('/api/tags');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as TagInfo[];
    },
    staleTime: 30000,
  });
}

// --- POST: Create a new tag ---
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, colorHex }: { name: string; colorHex?: string }) => {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, colorHex }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as TagInfo;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.all });
      toast.success(`Tag "${newTag.name}" created`);
    },
    onError: (error) => {
      toast.error(`Failed to create tag: ${error.message}`);
    },
  });
}

// --- PATCH: Update tag ---
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, colorHex }: { id: string; name?: string; colorHex?: string }) => {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, colorHex }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as TagInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.all });
      toast.success('Tag updated');
    },
    onError: (error) => {
      toast.error(`Failed to update tag: ${error.message}`);
    },
  });
}

// --- DELETE: Delete tag ---
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.all });
      // Also invalidate node queries since tags might be referenced
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Tag deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete tag: ${error.message}`);
    },
  });
}

// --- GET: Fetch tags for a specific node ---
export function useNodeTags(nodeId: string) {
  return useQuery({
    queryKey: TAG_KEYS.nodeTags(nodeId),
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}/tags`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NodeTagInfo[];
    },
    enabled: !!nodeId,
    staleTime: 30000,
  });
}

// --- POST: Assign a tag to a node ---
export function useAddNodeTag(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tagId }: { tagId: string }) => {
      const res = await fetch(`/api/nodes/${nodeId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NodeTagInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.nodeTags(nodeId) });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Tag assigned');
    },
    onError: (error) => {
      toast.error(`Failed to assign tag: ${error.message}`);
    },
  });
}

// --- DELETE: Remove a tag from a node ---
export function useRemoveNodeTag(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tagId }: { tagId: string }) => {
      const res = await fetch(`/api/nodes/${nodeId}/tags?tagId=${tagId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.nodeTags(nodeId) });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Tag removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove tag: ${error.message}`);
    },
  });
}

// --- PATCH: Toggle favorite on a node ---
export function useToggleFavorite(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ isFavorite }: { isFavorite?: boolean }) => {
      const res = await fetch(`/api/nodes/${nodeId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as { id: string; isFavorite: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: FAVORITE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success(result.isFavorite ? 'Added to favorites' : 'Removed from favorites');
    },
    onError: (error) => {
      toast.error(`Failed to toggle favorite: ${error.message}`);
    },
  });
}

// --- GET: Fetch favorite nodes list ---
export function useFavorites() {
  return useQuery({
    queryKey: FAVORITE_KEYS.list(),
    queryFn: async () => {
      const res = await fetch('/api/nodes/favorites');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as Array<{
        id: string;
        type: string;
        name: string;
        parentId: string | null;
        ownerId: string;
        isFavorite: boolean;
        createdAt: string;
        updatedAt: string;
        metadata: Record<string, unknown> | null;
        content: Record<string, unknown> | null;
        tags: NodeTagInfo[];
      }>;
    },
    staleTime: 30000,
  });
}
