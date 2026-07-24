// ============================================================
// MODUL 34: Note Editor with Backlinks — Integration wrapper
// Combines NoteEditor (with lazy loading + offline support) with
// BacklinkPanel rendered below it, and NoteGraphView accessible
// via a "Graph" tab/button.
//
// This is the integration point that bridges Module 34 features
// with the existing workspace content area.
// ============================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Network } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useNoteRevisions } from '@/hooks/use-note-revisions';
import { queueNoteEdit, syncQueuedEdits, getUnsyncedCount, registerBackgroundSync } from '@/lib/offline-queue';
import { retryWithBackoff } from '@/lib/retry';
import { reportError } from '@/lib/error-reporter';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BacklinkPanel } from '@/components/backlink/backlink-panel';
import { NoteGraphView } from '@/components/backlink/note-graph-view';
import { NoteLinkUpdate } from '@/hooks/use-note-link-update';
import dynamic from 'next/dynamic';

// Editor skeleton shown while TiptapEditorEnhanced is loading
function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Editor skeleton */}
      <div className="flex flex-col border rounded-lg bg-background">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded" />
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-1.5 border-b">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      {/* Backlink panel skeleton */}
      <div className="border rounded-lg bg-background p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

// Dynamic import for enhanced TiptapEditor with NoteLinkMentionNode support
const TiptapEditorEnhanced = dynamic(
  () => import('@/components/editor/tiptap-editor-enhanced').then(mod => ({ default: mod.TiptapEditorEnhanced })),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

interface NoteEditorWithBacklinksProps {
  nodeId: string;
  onNavigateToNote?: (noteId: string, noteName: string) => void;
}

export function NoteEditorWithBacklinks({ nodeId, onNavigateToNote }: NoteEditorWithBacklinksProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const userId = user?.id || '';
  const userName = user?.name || user?.email || 'Anonymous';

  const [showGraph, setShowGraph] = useState(false);

  // Revision snapshot interval hook
  const { checkRevisionInterval, resetRevisionTracking } = useNoteRevisions({ nodeId });

  // Note link update mutation
  const noteLinkUpdate = NoteLinkUpdate();

  // Reset revision tracking when node changes
  useEffect(() => {
    resetRevisionTracking();
  }, [nodeId, resetRevisionTracking]);

  // Sync queued offline edits when connection returns
  useEffect(() => {
    const syncOnReconnect = async () => {
      const count = await getUnsyncedCount();
      if (count > 0) {
        const result = await syncQueuedEdits();
        if (result.synced > 0) {
          toast.success(`Synced ${result.synced} offline edits`);
          queryClient.invalidateQueries({ queryKey: ['note'] });
          queryClient.invalidateQueries({ queryKey: ['nodes'] });
        }
      }
    };

    window.addEventListener('online', syncOnReconnect);
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

  // Save mutation — with retry + offline queue + note link update
  const saveMutation = useMutation({
    mutationFn: async (contentJson: string) => {
      try {
        const result = await retryWithBackoff(
          async () => {
            const res = await fetch(`/api/nodes/${nodeId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentJson }),
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
      reportError(error instanceof Error ? error : new Error(String(error)), {
        userId,
        action: 'save_note',
        componentName: 'NoteEditorWithBacklinks',
        additionalData: { nodeId },
      });
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('will sync')) {
        toast.error(`Save failed: ${message}`);
      }
    },
  });

  // Save handler passed to TiptapEditorEnhanced
  const handleSave = useCallback(async (contentJson: string) => {
    await saveMutation.mutateAsync(contentJson);
    checkRevisionInterval(contentJson);

    // Trigger note link update after successful save (Module 34)
    noteLinkUpdate.mutate({ nodeId, contentJson });
  }, [saveMutation, checkRevisionInterval, noteLinkUpdate, nodeId]);

  // Handle navigation to a different note (from backlinks or note link mention)
  const handleNavigateToNote = useCallback((noteId: string, noteName: string) => {
    if (onNavigateToNote) {
      onNavigateToNote(noteId, noteName);
    } else {
      // Dispatch custom event for workspace layout
      const event = new CustomEvent('note-link-click', {
        detail: { noteId, noteName },
        bubbles: true,
      });
      document.dispatchEvent(event);
    }
  }, [onNavigateToNote]);

  if (isLoading) {
    return <EditorSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4"
    >
      {/* View toggle: Editor / Graph */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGraph ? 'outline' : 'secondary'}
                size="sm"
                className="text-xs"
                onClick={() => setShowGraph(false)}
              >
                Editor
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit note content</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGraph ? 'secondary' : 'outline'}
                size="sm"
                className="text-xs flex items-center gap-1"
                onClick={() => setShowGraph(true)}
              >
                <Network className="h-3.5 w-3.5" />
                Graph
              </Button>
            </TooltipTrigger>
            <TooltipContent>View note link graph</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <AnimatePresence mode="wait">
        {!showGraph ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TiptapEditorEnhanced
              nodeId={nodeId}
              userId={userId}
              userName={userName}
              initialContent={noteData}
              onSave={handleSave}
              isSaving={saveMutation.isPending}
              onNavigateToNote={handleNavigateToNote}
            />
          </motion.div>
        ) : (
          <motion.div
            key="graph"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <NoteGraphView onNavigateToNote={handleNavigateToNote} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
