'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { useNoteRevisions } from '@/hooks/use-note-revisions';

// ============================================================
// NoteEditor — Wrapper that connects TiptapEditor to API + Collab
// Modul 10: userId/userName for collab integration
// Modul 16.2: Revision snapshot interval management
// ============================================================

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

  // Fetch note content (returns the raw contentJson string)
  const { data: noteData, isLoading } = useQuery({
    queryKey: ['note', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Return the contentJson string directly (TiptapEditor will parse it)
      if (data.data?.content?.contentJson) {
        return data.data.content.contentJson;
      }
      return null;
    },
    staleTime: 30000,
  });

  // Save mutation — sends contentJson to API
  const saveMutation = useMutation({
    mutationFn: async (contentJson: string) => {
      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentJson,
        }),
      });

      const responseData = await res.json();
      if (!responseData.success) throw new Error(responseData.error);
      return responseData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    },
  });

  // Save handler passed to TiptapEditor
  // Modul 16.2: After each successful autosave, check if revision should be created
  const handleSave = useCallback(async (contentJson: string) => {
    await saveMutation.mutateAsync(contentJson);
    // Check revision interval after successful save (16.2)
    checkRevisionInterval(contentJson);
  }, [saveMutation, checkRevisionInterval]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading note...</span>
      </div>
    );
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
