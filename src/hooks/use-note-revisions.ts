'use client';

// ============================================================
// MODUL 16.2: Note Revision Snapshot Interval Hook
// Prevents bloat by creating revision snapshots at intervals:
// - Every 10 autosave cycles OR every 15 minutes of active editing
// - Tracks autosave count and last revision time in refs
// ============================================================

import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Interval thresholds for revision creation
const AUTOSAVE_CYCLES_THRESHOLD = 10;  // Create revision every 10 autosave cycles
const TIME_INTERVAL_MS = 15 * 60 * 1000; // Create revision every 15 minutes (900000ms)

interface UseNoteRevisionsOptions {
  nodeId: string;
}

export function useNoteRevisions({ nodeId }: UseNoteRevisionsOptions) {
  const queryClient = useQueryClient();

  // Track autosave cycles since last revision
  const autosaveCountRef = useRef(0);

  // Track timestamp of last revision creation
  const lastRevisionTimeRef = useRef<number>(Date.now());

  // Track if a revision creation is currently in progress
  const isCreatingRevisionRef = useRef(false);

  // Create revision mutation — POST to API
  const createRevisionMutation = useMutation({
    mutationFn: async (contentJson: string) => {
      const res = await fetch(`/api/nodes/${nodeId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentJson, triggerType: 'autosave' }),
      });
      const json = await res.json();
      // 409 means revision already exists for this content — not an error
      if (!json.success && json.error !== 'Revision already exists') {
        throw new Error(json.error);
      }
      return json.data;
    },
    onSuccess: () => {
      // Reset counters after successful revision creation
      autosaveCountRef.current = 0;
      lastRevisionTimeRef.current = Date.now();
      isCreatingRevisionRef.current = false;

      // Invalidate revision list so sidebar shows new revision
      queryClient.invalidateQueries({ queryKey: ['note-revisions', nodeId] });
    },
    onError: () => {
      // Reset creating flag so we can try again later
      isCreatingRevisionRef.current = false;
      // Don't toast errors for autosave revisions — they're background ops
    },
  });

  // Check if revision should be created based on interval thresholds
  // Called by the autosave handler in tiptap-editor after each successful save
  const checkRevisionInterval = useCallback((currentContentJson: string) => {
    // Skip if revision creation is already in progress
    if (isCreatingRevisionRef.current) return;

    // Increment autosave counter
    autosaveCountRef.current += 1;

    // Check time-based threshold
    const now = Date.now();
    const timeSinceLastRevision = now - lastRevisionTimeRef.current;
    const hasReachedTimeThreshold = timeSinceLastRevision >= TIME_INTERVAL_MS;

    // Check cycle-based threshold
    const hasReachedCycleThreshold = autosaveCountRef.current >= AUTOSAVE_CYCLES_THRESHOLD;

    // Create revision if either threshold is reached
    if (hasReachedTimeThreshold || hasReachedCycleThreshold) {
      isCreatingRevisionRef.current = true;
      createRevisionMutation.mutate(currentContentJson);
    }
  }, [createRevisionMutation]);

  // Force create a manual revision (e.g., Ctrl+Shift+S or explicit save)
  const createManualRevision = useCallback((contentJson: string) => {
    if (isCreatingRevisionRef.current) return;
    isCreatingRevisionRef.current = true;

    // Directly call the API for manual revision creation
    fetch(`/api/nodes/${nodeId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentJson, triggerType: 'manual' }),
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          lastRevisionTimeRef.current = Date.now();
          autosaveCountRef.current = 0;
          queryClient.invalidateQueries({ queryKey: ['note-revisions', nodeId] });
          toast.success('Revision saved');
        }
        isCreatingRevisionRef.current = false;
      })
      .catch(() => {
        isCreatingRevisionRef.current = false;
        toast.error('Failed to save revision');
      });
  }, [nodeId, queryClient]);

  // Reset counters (useful when loading a new note)
  const resetRevisionTracking = useCallback(() => {
    autosaveCountRef.current = 0;
    lastRevisionTimeRef.current = Date.now();
    isCreatingRevisionRef.current = false;
  }, []);

  return {
    checkRevisionInterval,
    createManualRevision,
    resetRevisionTracking,
    autosaveCount: autosaveCountRef.current,
  };
}
