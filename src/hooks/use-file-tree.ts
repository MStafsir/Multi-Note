// ============================================================
// MODUL 4.6: React Query Hooks — Node CRUD with cache invalidation
// Key structure: ['nodes', parentId] — invalidation on mutations
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TreeNode, NodeType } from '@/types';
import { useFileTreeStore } from '@/store/file-tree';
import { toast } from 'sonner';
import { retryWithBackoff } from '@/lib/retry';
import { reportError } from '@/lib/error-reporter';

// --- Query Keys (4.6) ---
const NODE_KEYS = {
  all: ['nodes'] as const,
  list: (parentId: string | null) => ['nodes', 'list', parentId] as const,
  detail: (id: string) => ['nodes', 'detail', id] as const,
};

// --- GET: Fetch nodes for a folder ---
export function useNodeList(parentId: string | null) {
  const { setTree, setLoading, setError } = useFileTreeStore();

  return useQuery({
    queryKey: NODE_KEYS.list(parentId),
    queryFn: async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (parentId) params.set('parentId', parentId);

        const res = await fetch(`/api/nodes?${params.toString()}`);
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error);
        }

        // Build tree from flat data
        const allNodes: TreeNode[] = (data.data.allNodes || []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          name: n.name as string,
          type: n.type as NodeType,
          parentId: n.parentId as string | null,
          children: [],
          metadata: n.metadata as Record<string, unknown> | undefined,
          content: n.content as Record<string, unknown> | undefined,
          isFavorite: n.isFavorite as boolean | undefined,
          createdAt: n.createdAt as string,
          updatedAt: n.updatedAt as string,
        }));

        const tree = buildTreeFromFlat(allNodes);
        setTree(tree);
        setError(null);
        return data.data;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load';
        setError(msg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    staleTime: 30000,
  });
}

// --- POST: Create folder ---
export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { addNode, currentFolderId } = useFileTreeStore();

  return useMutation({
    mutationFn: async ({ parentId, name, type }: { parentId?: string | null; name: string; type?: string }) => {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parentId || currentFolderId, name, type: type || 'folder' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (newNode) => {
      addNode({
        id: newNode.id,
        name: newNode.name,
        type: newNode.type,
        parentId: newNode.parentId,
        children: [],
        createdAt: newNode.createdAt,
        updatedAt: newNode.updatedAt,
      });
      // 4.6 — Invalidate the parent folder's node list
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.list(newNode.parentId) });
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.all });
      toast.success(`${newNode.type === 'folder' ? 'Folder' : 'Note'} "${newNode.name}" created`);
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });
}

// --- PATCH: Rename node (4.2 — optimistic update + rollback) ---
export function useRenameNode() {
  const queryClient = useQueryClient();
  const { optimisticRename, rollbackRename } = useFileTreeStore();

  return useMutation({
    mutationFn: async ({ nodeId, newName }: { nodeId: string; newName: string }) => {
      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onMutate: async ({ nodeId, newName }) => {
      // 4.2 — Optimistic update
      const oldName = optimisticRename(nodeId, newName);
      return { oldName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.all });
      toast.success(`Renamed to "${data.name}"`);
    },
    onError: (error, { nodeId }, context) => {
      // 4.2 — Rollback on error
      if (context?.oldName) {
        rollbackRename(nodeId, context.oldName);
      }
      toast.error(`Rename failed: ${error.message}`);
    },
  });
}

// --- PATCH: Move node (4.4 — optimistic update + rollback) ---
export function useMoveNode() {
  const queryClient = useQueryClient();
  const { optimisticMove, rollbackMove } = useFileTreeStore();

  return useMutation({
    mutationFn: async ({ nodeId, newParentId }: { nodeId: string; newParentId: string | null }) => {
      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newParentId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onMutate: async ({ nodeId, newParentId }) => {
      const result = optimisticMove(nodeId, newParentId);
      return { oldParentId: result?.oldParentId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.all });
      toast.success('Moved successfully');
    },
    onError: (error, { nodeId }, context) => {
      if (context?.oldParentId !== undefined) {
        rollbackMove(nodeId, context.oldParentId);
      }
      toast.error(`Move failed: ${error.message}`);
    },
  });
}

// --- DELETE: Soft-delete node (4.3) — with retry logic (26.3) ---
export function useDeleteNode() {
  const queryClient = useQueryClient();
  const { optimisticDelete } = useFileTreeStore();

  return useMutation({
    mutationFn: async ({ nodeId }: { nodeId: string }) => {
      // 26.3 — Retry delete with exponential backoff (max 3 retries)
      return retryWithBackoff(
        async () => {
          const res = await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!data.success) throw new Error(data.error);
          return data.data;
        },
        { maxRetries: 3, baseDelay: 1000 }
      ).then(result => result.data);
    },
    onMutate: async ({ nodeId }) => {
      optimisticDelete([nodeId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.all });
      toast.success('Deleted');
    },
    onError: (error) => {
      reportError(error instanceof Error ? error : new Error(String(error)), {
        action: 'delete',
        componentName: 'useDeleteNode',
      });
      toast.error(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
      // Force re-fetch for accurate rollback
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.all });
    },
  });
}

// --- POST: Upload file (Modul 5) ---
export function useUploadFile() {
  const queryClient = useQueryClient();
  const { addNode, currentFolderId } = useFileTreeStore();
  const { addUpload, updateUpload, removeUpload } = useUploadStoreImport();

  return useMutation({
    mutationFn: async ({ file, parentId }: { file: File; parentId?: string | null }) => {
      const fileId = `upload-${Date.now()}-${file.name}`;

      addUpload({
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('parentId', parentId || currentFolderId || '');

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!data.success) {
          updateUpload(fileId, { status: 'error', error: data.error });
          throw new Error(data.error);
        }

        updateUpload(fileId, { progress: 100, status: 'complete' });

        // Clean up after 3 seconds
        setTimeout(() => removeUpload(fileId), 3000);

        return data.data;
      } catch (error) {
        updateUpload(fileId, { status: 'error', error: error instanceof Error ? error.message : 'Upload failed' });
        throw error;
      }
    },
    onSuccess: (newNode) => {
      addNode({
        id: newNode.id,
        name: newNode.name,
        type: 'file',
        parentId: newNode.parentId,
        children: [],
        metadata: newNode.metadata,
        createdAt: newNode.createdAt,
        updatedAt: newNode.updatedAt,
      });
      queryClient.invalidateQueries({ queryKey: NODE_KEYS.all });
      toast.success(`File "${newNode.name}" uploaded`);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });
}

// --- GET: Storage quota ---
export function useStorageQuota() {
  return useQuery({
    queryKey: ['storage-quota'],
    queryFn: async () => {
      const res = await fetch('/api/storage-quota');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    staleTime: 60000,
  });
}

// Helper: Build tree from flat list (4.5)
function buildTreeFromFlat(nodes: TreeNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      rootNodes.push(treeNode);
    }
  }

  // Sort: folders first, then alphabetically
  for (const [, node] of nodeMap) {
    node.children.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  rootNodes.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  return rootNodes;
}

// Import upload store (separate to avoid circular deps)
import { useUploadStore as useUploadStoreImport } from '@/store/upload';
