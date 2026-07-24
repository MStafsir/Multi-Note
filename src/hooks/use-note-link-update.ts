// ============================================================
// MODUL 34: Note Link Update Hook — React Query mutation
// POST /api/note-links — triggers updateNoteLinks on the server
// Called after note content save to update the note_links table
// ============================================================

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NoteLinkUpdateResponse } from '@/types/backlink-augmented';

/**
 * useNoteLinkUpdate — Mutation hook to trigger note link extraction/update
 *
 * Usage: After saving note content (PATCH /api/nodes/[id]), call this mutation
 * to update the note_links table based on NoteLinkMention nodes in the content.
 *
 * This is a bridge solution until updateNoteLinks is integrated into the
 * existing PATCH /api/nodes/[id] route.
 */
export function useNoteLinkUpdate() {
  const queryClient = useQueryClient();

  return useMutation<NoteLinkUpdateResponse, Error, { nodeId: string; contentJson?: string }>({
    mutationFn: async ({ nodeId, contentJson }) => {
      const res = await fetch('/api/note-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, contentJson }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update note links');
      }

      return data.data as NoteLinkUpdateResponse;
    },
    onSuccess: (result, variables) => {
      // Invalidate backlinks for this note (both incoming and outgoing)
      queryClient.invalidateQueries({ queryKey: ['backlinks', variables.nodeId] });
      // Invalidate graph data (links changed)
      queryClient.invalidateQueries({ queryKey: ['graph'] });
      // Invalidate nodes list (backlink count may have changed)
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
    // Don't show error toast — link updates are supplementary, failures shouldn't block user
    onError: () => {
      // Silently fail — link extraction is non-blocking
    },
  });
}
