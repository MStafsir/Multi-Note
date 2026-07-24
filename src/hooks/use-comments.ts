// ============================================================
// MODUL 35: In-Note Threaded Commenting System — React Query Hooks
// 35.7 — useComments, useCreateComment, useUpdateComment,
//         useDeleteComment, useResolveComment, useCommentThreads
// ============================================================

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CommentInfo, CommentThread, AnchorPosition } from '@/types';

// --- Query Keys ---
const COMMENT_KEYS = {
  all: ['comments'] as const,
  list: (nodeId: string, includeResolved: boolean) => ['comments', 'list', nodeId, includeResolved] as const,
  threads: (nodeId: string, includeResolved: boolean) => ['comments', 'threads', nodeId, includeResolved] as const,
};

// --- GET: Fetch comments for a node ---
export function useComments(nodeId: string, includeResolved = false) {
  return useQuery({
    queryKey: COMMENT_KEYS.list(nodeId, includeResolved),
    queryFn: async () => {
      const res = await fetch(`/api/comments?nodeId=${encodeURIComponent(nodeId)}&includeResolved=${includeResolved}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as {
        comments: CommentInfo[];
        threads: CommentThread[];
        total: number;
      };
    },
    enabled: !!nodeId,
    staleTime: 10000,
    refetchInterval: 15000, // Near-realtime polling (35.6)
  });
}

// --- GET: Fetch comment threads (grouped) ---
export function useCommentThreads(nodeId: string, includeResolved = false) {
  const query = useComments(nodeId, includeResolved);
  return {
    ...query,
    data: query.data?.threads ?? [],
  };
}

// --- POST: Create a new comment ---
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      nodeId: string;
      content: string;
      anchorPosition?: AnchorPosition | null;
      parentCommentId?: string | null;
    }) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as CommentInfo;
    },
    onSuccess: (newComment, variables) => {
      // Invalidate comment lists for this node (both resolved and unresolved)
      queryClient.invalidateQueries({ queryKey: ['comments', 'list', variables.nodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments', 'threads', variables.nodeId] });
      // Also invalidate notifications since mentions trigger notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Comment added');
    },
    onError: (error) => {
      toast.error(`Failed to add comment: ${error.message}`);
    },
  });
}

// --- PATCH: Update comment content ---
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      commentId: string;
      content: string;
      nodeId: string; // Needed for cache invalidation
    }) => {
      const res = await fetch(`/api/comments/${params.commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: params.content }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as CommentInfo;
    },
    onSuccess: (updatedComment, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', 'list', variables.nodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments', 'threads', variables.nodeId] });
      toast.success('Comment updated');
    },
    onError: (error) => {
      toast.error(`Failed to update comment: ${error.message}`);
    },
  });
}

// --- PATCH: Resolve/unresolve comment ---
export function useResolveComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      commentId: string;
      resolved: boolean;
      nodeId: string;
    }) => {
      const res = await fetch(`/api/comments/${params.commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: params.resolved }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as CommentInfo;
    },
    onSuccess: (result, variables) => {
      // Invalidate both resolved and unresolved lists since a comment changed state
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      toast.success(variables.resolved ? 'Comment resolved' : 'Comment reopened');
    },
    onError: (error) => {
      toast.error(`Failed to resolve/unresolve: ${error.message}`);
    },
  });
}

// --- DELETE: Delete a comment ---
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      commentId: string;
      nodeId: string;
    }) => {
      const res = await fetch(`/api/comments/${params.commentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as { id: string };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', 'list', variables.nodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments', 'threads', variables.nodeId] });
      // Also invalidate resolved variant
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      toast.success('Comment deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete comment: ${error.message}`);
    },
  });
}

// --- GET: Fetch users with access to a node (for @mention autocomplete) ---
export function useNodeAccessibleUsers(nodeId: string) {
  return useQuery({
    queryKey: ['comments', 'users', nodeId],
    queryFn: async () => {
      // Get node owner + users from node_shares
      const res = await fetch(`/api/nodes/${nodeId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const ownerId = data.data?.ownerId as string;
      const ownerName = data.data?.owner?.name as string | null;
      const ownerEmail = data.data?.owner?.email as string | null;

      const users: Array<{ id: string; name: string | null; email: string | null }> = [
        { id: ownerId, name: ownerName, email: ownerEmail },
      ];

      // Get shares for this node
      const sharesRes = await fetch(`/api/shares?nodeId=${encodeURIComponent(nodeId)}`);
      const sharesData = await sharesRes.json();
      if (sharesData.success && sharesData.data?.shares) {
        for (const share of sharesData.data.shares as Array<{ sharedWithUserId?: string; sharedWithName?: string; sharedWithEmail?: string }>) {
          if (share.sharedWithUserId && !users.find(u => u.id === share.sharedWithUserId)) {
            users.push({
              id: share.sharedWithUserId,
              name: share.sharedWithName ?? null,
              email: share.sharedWithEmail ?? null,
            });
          }
        }
      }

      return users;
    },
    enabled: !!nodeId,
    staleTime: 60000,
  });
}

export { COMMENT_KEYS };
