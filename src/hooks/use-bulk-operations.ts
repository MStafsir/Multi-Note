// ============================================================
// MODUL 18: Bulk Operations — React Query Hooks
// Mutations for bulk delete, move, download (ZIP), share, tag
// All mutations invalidate ['nodes'] on success
// ============================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFileTreeStore } from '@/store/file-tree';

// --- Bulk Delete (18.3) ---
export function useBulkDelete() {
  const queryClient = useQueryClient();
  const { optimisticDelete } = useFileTreeStore();

  return useMutation({
    mutationFn: async ({ nodeIds }: { nodeIds: string[] }) => {
      const res = await fetch('/api/nodes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as { deletedCount: number };
    },
    onMutate: async ({ nodeIds }) => {
      // Optimistic update: remove nodes from UI immediately
      optimisticDelete(nodeIds);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success(`${result.deletedCount} items deleted`);
    },
    onError: (error) => {
      // Force re-fetch for accurate rollback
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.error(`Bulk delete failed: ${error.message}`);
    },
  });
}

// --- Bulk Move (18.2) ---
export interface BulkMoveResult {
  movedCount: number;
}

export function useBulkMove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeIds, targetFolderId }: { nodeIds: string[]; targetFolderId: string | null }) => {
      const res = await fetch('/api/nodes/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds, targetFolderId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as BulkMoveResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success(`${result.movedCount} items moved`);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.error(`Bulk move failed: ${error.message}`);
    },
  });
}

// --- Bulk Download as ZIP (18.4) ---
export function useBulkDownload() {
  return useMutation({
    mutationFn: async ({ nodeIds }: { nodeIds: string[] }) => {
      const res = await fetch('/api/nodes/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds }),
      });

      if (!res.ok) {
        // Try to parse error JSON from non-200 response
        try {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Download failed');
        } catch {
          throw new Error(`Download failed (HTTP ${res.status})`);
        }
      }

      // Get the blob from the response
      const blob = await res.blob();

      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'workspace-export.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true };
    },
    onSuccess: () => {
      toast.success('ZIP download started');
    },
    onError: (error) => {
      toast.error(`Bulk download failed: ${error.message}`);
    },
  });
}

// --- Bulk Share (18.2) ---
export interface BulkShareResult {
  sharedCount: number;
  failedCount: number;
}

export function useBulkShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeIds, sharedWithUserId, permissionLevel }: { nodeIds: string[]; sharedWithUserId: string; permissionLevel: string }) => {
      const res = await fetch('/api/nodes/bulk-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds, sharedWithUserId, permissionLevel }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as BulkShareResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      if (result.failedCount > 0) {
        toast.success(`${result.sharedCount} items shared, ${result.failedCount} already shared or failed`);
      } else {
        toast.success(`${result.sharedCount} items shared successfully`);
      }
    },
    onError: (error) => {
      toast.error(`Bulk share failed: ${error.message}`);
    },
  });
}

// --- Bulk Tag (18.2) ---
export interface BulkTagResult {
  taggedCount: number;
}

export function useBulkTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeIds, tagId }: { nodeIds: string[]; tagId: string }) => {
      const res = await fetch('/api/nodes/bulk-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds, tagId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as BulkTagResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success(`${result.taggedCount} items tagged`);
    },
    onError: (error) => {
      toast.error(`Bulk tag failed: ${error.message}`);
    },
  });
}
