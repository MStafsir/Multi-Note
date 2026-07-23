'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface NoteEditorProps {
  nodeId: string;
}

export function NoteEditor({ nodeId }: NoteEditorProps) {
  const [localContent, setLocalContent] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const queryClient = useQueryClient();

  // Fetch note content
  const { data, isLoading } = useQuery({
    queryKey: ['note', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Parse the Tiptap JSON content to plain text for the textarea placeholder
      if (data.data?.content?.contentJson) {
        try {
          const parsed = JSON.parse(data.data.content.contentJson);
          // Extract text from Tiptap ProseMirror JSON
          return extractTextFromTiptapJson(parsed);
        } catch {
          return data.data.content.contentJson;
        }
      }
      return '';
    },
    staleTime: 30000,
  });

  // Display content: local edits or server data
  const displayContent = isDirty ? (localContent ?? '') : (data ?? '');

  // Save note content
  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      // Convert plain text to Tiptap JSON format for storage
      const tiptapJson = {
        type: 'doc',
        content: newContent
          .split('\n')
          .map((line) => ({
            type: 'paragraph',
            content: line ? [{ type: 'text', text: line }] : [],
          })),
      };

      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentJson: JSON.stringify(tiptapJson),
        }),
      });

      const responseData = await res.json();
      if (!responseData.success) throw new Error(responseData.error);
      return responseData.data;
    },
    onSuccess: () => {
      setIsDirty(false);
      setLocalContent(null);
      queryClient.invalidateQueries({ queryKey: ['note', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Note saved');
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    },
  });

  const handleSave = useCallback(() => {
    if (isDirty && localContent !== null) {
      saveMutation.mutate(localContent);
    }
  }, [isDirty, localContent, saveMutation]);

  // Auto-save with Ctrl+S
  const handleSaveRef = useRef(handleSave);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading note...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {isDirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save
        </Button>
      </div>

      <Textarea
        value={displayContent}
        onChange={(e) => {
          setLocalContent(e.target.value);
          setIsDirty(true);
        }}
        placeholder="Start writing your note..."
        className="min-h-[400px] resize-y font-mono text-sm"
      />

      <p className="text-xs text-muted-foreground">
        Press Ctrl+S to save. Full rich-text editor coming soon.
      </p>
    </div>
  );
}

// Helper: Extract text from Tiptap ProseMirror JSON
function extractTextFromTiptapJson(json: Record<string, unknown>): string {
  const lines: string[] = [];

  if (json.type === 'doc' && Array.isArray(json.content)) {
    for (const node of json.content as Record<string, unknown>[]) {
      lines.push(extractTextFromNode(node));
    }
  } else {
    lines.push(extractTextFromNode(json));
  }

  return lines.join('\n');
}

function extractTextFromNode(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    return (node.text as string) || '';
  }

  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[])
      .map((child) => extractTextFromNode(child))
      .join('');
  }

  return '';
}
