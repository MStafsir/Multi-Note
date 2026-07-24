'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';
import { EditorToolbar } from './editor-toolbar';
import { EmbeddedFileNode } from './embedded-file-node';
import { PresenceIndicator } from './presence-indicator';
import { useNoteCollab } from '@/hooks/use-collab';

// ============================================================
// TiptapEditor — Full rich-text editor with autosave + collab
// Modul 9: Note Editor Core — Block-based Architecture
// Modul 10: Real-time Collaboration Layer
// ============================================================

interface TiptapEditorProps {
  nodeId: string;
  userId: string;
  userName: string;
  initialContent?: string | null;
  onSave: (contentJson: string) => Promise<void>;
  isSaving: boolean;
}

export function TiptapEditor({
  nodeId,
  userId,
  userName,
  initialContent,
  onSave,
  isSaving,
}: TiptapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef<string | null>(null);
  const isApplyingRemoteUpdate = useRef(false);

  // Connect to collab service (Modul 10)
  const { connectedUsers, latestContent, isConnected, emitUpdate } = useNoteCollab(
    nodeId,
    userId,
    userName
  );

  // Derived: show reconnecting indicator when disconnected with unsaved changes
  // Uses saveStatus state (not ref) so it's a proper render-derived value
  const showReconnecting = !isConnected && saveStatus === 'unsaved';

  // Parse initial content from JSON string
  const parsedContent = useCallback(() => {
    if (!initialContent) return null;
    try {
      return JSON.parse(initialContent);
    } catch {
      // If it's plain text, wrap in a paragraph
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: initialContent }],
          },
        ],
      };
    }
  }, [initialContent]);

  // Perform save (called by both autosave and manual save)
  const performSave = useCallback(async (contentJson: string) => {
    setSaveStatus('saving');
    try {
      await onSave(contentJson);
      lastSavedContentRef.current = contentJson;
      isDirtyRef.current = false;
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  }, [onSave]);

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing... Type / for commands',
      }),
      EmbeddedFileNode,
    ],
    content: parsedContent(),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-6',
      },
    },
    onUpdate: ({ editor }) => {
      // Skip if we're applying a remote update — also mark clean
      if (isApplyingRemoteUpdate.current) {
        isApplyingRemoteUpdate.current = false;
        setSaveStatus('saved');
        return;
      }

      // Mark as unsaved
      setSaveStatus('unsaved');
      isDirtyRef.current = true;

      // Emit update via collab (Modul 10: last-write-wins broadcast)
      const contentJson = JSON.stringify(editor.getJSON());
      emitUpdate(contentJson);

      // Autosave debounced 800ms
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const json = JSON.stringify(editor.getJSON());
        if (json !== lastSavedContentRef.current) {
          performSave(json);
        } else {
          // Content is same as last saved, just mark as saved
          setSaveStatus('saved');
        }
      }, 800);
    },
    immediatelyRender: false,
  });

  // Ctrl+S handler — save immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (editor && isDirtyRef.current) {
          const json = JSON.stringify(editor.getJSON());
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          performSave(json);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, performSave]);

  // beforeunload handler — try navigator.sendBeacon to save
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current && editor) {
        const json = JSON.stringify(editor.getJSON());
        const payload = JSON.stringify({
          contentJson: json,
        });

        try {
          navigator.sendBeacon(`/api/nodes/${nodeId}`, new Blob([payload], { type: 'application/json' }));
        } catch {
          // sendBeacon not available — nothing we can do
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editor, nodeId]);

  // Apply remote content updates from collab (Modul 10: external system sync)
  useEffect(() => {
    if (editor && latestContent) {
      try {
        const parsedContent = JSON.parse(latestContent);
        isApplyingRemoteUpdate.current = true;
        editor.commands.setContent(parsedContent);

        // Cancel any pending auto-save since we just received content
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      } catch {
        console.error('[tiptap-editor] Failed to parse remote content');
      }
    }
  }, [editor, latestContent]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading editor...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col border rounded-lg bg-background"
    >
      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Save status indicator + Presence (Modul 10) */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b">
        <div className="flex items-center gap-3">
          {/* Presence indicator — shows who's viewing the same note */}
          <PresenceIndicator connectedUsers={connectedUsers} isConnected={isConnected} />

          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-emerald-600">Saved</span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-xs text-orange-500">Unsaved changes</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Reconnecting indicator (Modul 10) */}
          <AnimatePresence>
            {showReconnecting && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-1.5 text-xs text-orange-500 dark:text-orange-400"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span>Reconnecting...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <span className="text-xs text-muted-foreground">
            Ctrl+S to save
          </span>
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="tiptap-editor-content" />
      </div>
    </motion.div>
  );
}
