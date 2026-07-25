'use client';

// ============================================================
// MODUL 25.2: NoteEditor — Wrapper with offline support + lazy loading
// Uses dynamic import for TiptapEditor to reduce initial bundle
// When saving fails (network error), queues the change in IndexedDB
// When connection returns, syncs queued changes
// ============================================================

import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, WifiOff, CloudOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useNoteRevisions } from '@/hooks/use-note-revisions';
import { queueNoteEdit, syncQueuedEdits, getUnsyncedCount, registerBackgroundSync } from '@/lib/offline-queue';
import { retryWithBackoff } from '@/lib/retry';
import { reportError } from '@/lib/error-reporter';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Editor skeleton shown while TiptapEditor is loading
function EditorSkeleton() {
  return (
    <div className="flex flex-col border rounded-lg bg-background">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
      </div>
      {/* Status bar skeleton */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

// Dynamic import for TiptapEditor — reduces initial bundle size significantly
const TiptapEditor = dynamic(
  () => import('@/components/editor/tiptap-editor').then(mod => ({ default: mod.TiptapEditor })),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

interface NoteEditorProps {
  nodeId: string;
}

export function NoteEditor({ nodeId }: NoteEditorProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const userId = user?.id || '';
  const userName = user?.name || user?.email || 'Anonymous';

  // Modul 16.2: Revision snapshot interval hook
  const { checkRevisionInterval, resetRevisionTracking } = useNoteRevisions({ nodeId });

  // Reset revision tracking when node changes
  useEffect(() => {
    resetRevisionTracking();
  }, [nodeId, resetRevisionTracking]);

  // Sync queued offline edits when connection returns
  useEffect(() => {
    const syncOnReconnect = async () => {
      try {
        const count = await getUnsyncedCount();
        if (count > 0) {
          const result = await syncQueuedEdits();
          if (result.synced > 0) {
            toast.success(`Synced ${result.synced} offline edits`);
            queryClient.invalidateQueries({ queryKey: ['note'] });
            queryClient.invalidateQueries({ queryKey: ['nodes'] });
          }
        }
      } catch (err) {
        // IDB errors should not crash the component
        console.warn('Failed to sync offline edits:', err);
      }
    };

    // Listen for online event
    window.addEventListener('online', syncOnReconnect);
    // Also try syncing on mount if we have pending edits
    syncOnReconnect();

    return () => window.removeEventListener('online', syncOnReconnect);
  }, [queryClient]);

  // Register Background Sync for offline edits
  useEffect(() => {
    registerBackgroundSync();
  }, []);

  // Fetch note content
  const { data: noteData, isLoading } = useQuery({
    queryKey: ['note', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (data.data?.content?.contentJson) {
        return data.data.content.contentJson;
      }
      return null;
    },
    staleTime: 30000,
  });

  // Save mutation — with retry + offline queue fallback (26.3)
  const saveMutation = useMutation({
    mutationFn: async (contentJson: string) => {
      try {
        // 26.3 — Retry save with exponential backoff before queuing offline
        const result = await retryWithBackoff(
          async () => {
            const res = await fetch(`/api/nodes/${nodeId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentJson,
              }),
            });

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }

            const responseData = await res.json();
            if (!responseData.success) throw new Error(responseData.error);
            return responseData.data;
          },
          { maxRetries: 3, baseDelay: 1000 }
        );
        return result.data;
      } catch (error) {
        // All retries exhausted — queue the edit for offline sync
        await queueNoteEdit(nodeId, contentJson, new Date().toISOString());
        toast.warning('Saved locally — will sync when connection returns');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
    onError: (error) => {
      // Report error to logging system (26.4)
      reportError(error instanceof Error ? error : new Error(String(error)), {
        userId,
        action: 'save_note',
        componentName: 'NoteEditor',
        additionalData: { nodeId },
      });
      // Only show error if it's not a queued offline edit
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('will sync')) {
        toast.error(`Save failed: ${message}`);
      }
    },
  });

  // Save handler passed to TiptapEditor
  const handleSave = useCallback(async (contentJson: string) => {
    await saveMutation.mutateAsync(contentJson);
    checkRevisionInterval(contentJson);
  }, [saveMutation, checkRevisionInterval]);

  if (isLoading) {
    return <EditorSkeleton />;
  }

  return (
    <TiptapEditor
      nodeId={nodeId}
      userId={userId}
      userName={userName}
      initialContent={noteData}
      onSave={handleSave}
      isSaving={saveMutation.isPending}
    />
  );
}
