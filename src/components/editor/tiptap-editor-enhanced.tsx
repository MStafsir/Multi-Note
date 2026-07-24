// ============================================================
// MODUL 34.1: Enhanced Tiptap Editor with NoteLinkMentionNode support
// Extends the base TiptapEditor with:
// 1. NoteLinkMentionNode extension (renders [[nama-note]] inline links)
// 2. NoteLinkAutocomplete dropdown (triggered by typing [[)
// 3. NoteLink suggestion plugin (detects [[ and shows autocomplete)
// 4. BacklinkPanel rendered below the editor
// 5. Post-save hook that triggers note link update
//
// This is the full-featured editor that enables Module 34 features.
// It can be used as a drop-in replacement for TiptapEditor by updating
// the dynamic import in note-editor.tsx.
// ============================================================

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
import { MathBlockNode } from './math-block-node';
import { NoteLinkMentionNode, NoteLinkAutocomplete, createNoteLinkSuggestionPlugin } from './note-link-mention';
import { PresenceIndicator } from './presence-indicator';
import { BacklinkPanel } from '@/components/backlink/backlink-panel';
import { useNoteCollab } from '@/hooks/use-collab';
import { useNoteLinkUpdate } from '@/hooks/use-note-link-update';
import type { BacklinkInfoExtended } from '@/types/backlink-augmented';

interface TiptapEditorEnhancedProps {
  nodeId: string;
  userId: string;
  userName: string;
  initialContent?: string | null;
  onSave: (contentJson: string) => Promise<void>;
  isSaving: boolean;
  onNavigateToNote?: (noteId: string, noteName: string) => void;
}

export function TiptapEditorEnhanced({
  nodeId,
  userId,
  userName,
  initialContent,
  onSave,
  isSaving,
  onNavigateToNote,
}: TiptapEditorEnhancedProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef<string | null>(null);
  const isApplyingRemoteUpdate = useRef(false);

  // NoteLink autocomplete state
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [autocompletePosition, setAutocompletePosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const autocompleteCallbackRef = useRef<(noteId: string, noteName: string) => void>(() => {});

  // Note link update mutation
  const noteLinkUpdate = useNoteLinkUpdate();

  // Connect to collab service
  const { connectedUsers, latestContent, isConnected, emitUpdate } = useNoteCollab(
    nodeId,
    userId,
    userName
  );

  const showReconnecting = !isConnected && saveStatus === 'unsaved';

  // Parse initial content from JSON string
  const parsedContent = useCallback(() => {
    if (!initialContent) return null;
    try {
      return JSON.parse(initialContent);
    } catch {
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

  // Perform save — with note link update trigger
  const performSave = useCallback(async (contentJson: string) => {
    setSaveStatus('saving');
    try {
      await onSave(contentJson);
      lastSavedContentRef.current = contentJson;
      isDirtyRef.current = false;
      setSaveStatus('saved');

      // Trigger note link update after successful save (Module 34)
      noteLinkUpdate.mutate({ nodeId, contentJson });
    } catch {
      setSaveStatus('unsaved');
    }
  }, [onSave, noteLinkUpdate, nodeId]);

  // Create note link suggestion plugin callback handlers
  const handleSuggestionOpen = useCallback(
    (results: Array<{ id: string; name: string; type: string }>, callback: (noteId: string, noteName: string) => void) => {
      setAutocompleteOpen(true);
      setAutocompleteResults(results);
      autocompleteCallbackRef.current = callback;

      // Calculate position from editor selection
      if (typeof window !== 'undefined') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setAutocompletePosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }
      }
    },
    []
  );

  const handleSuggestionClose = useCallback(() => {
    setAutocompleteOpen(false);
    setAutocompleteResults([]);
  }, []);

  // Initialize Tiptap editor — with NoteLinkMentionNode extension
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
        placeholder: 'Start writing... Type / for commands, [[ to link a note',
      }),
      EmbeddedFileNode,
      MathBlockNode,
      NoteLinkMentionNode,
    ],
    content: parsedContent(),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-6',
      },
    },
    onUpdate: ({ editor }) => {
      if (isApplyingRemoteUpdate.current) {
        isApplyingRemoteUpdate.current = false;
        setSaveStatus('saved');
        return;
      }

      setSaveStatus('unsaved');
      isDirtyRef.current = true;

      const contentJson = JSON.stringify(editor.getJSON());
      emitUpdate(contentJson);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const json = JSON.stringify(editor.getJSON());
        if (json !== lastSavedContentRef.current) {
          performSave(json);
        } else {
          setSaveStatus('saved');
        }
      }, 800);
    },
    immediatelyRender: false,
  });

  // Register note link suggestion plugin when editor is ready
  useEffect(() => {
    if (!editor) return;

    // Register the suggestion plugin on the editor's ProseMirror view
    const suggestionPlugin = createNoteLinkSuggestionPlugin(
      editor,
      handleSuggestionOpen,
      handleSuggestionClose
    );

    // Add the plugin to the editor's state
    editor.view.dispatch(
      editor.state.tr.setMeta('addNoteLinkSuggestion', true)
    );

    // Note: The suggestion plugin needs to be registered via the editor's
    // ProseMirror plugin system. Since Tiptap's useEditor doesn't support
    // dynamic plugin addition, we use the NoteLinkMentionNode's addProseMirrorPlugins
    // method instead (see note-link-mention.tsx for the alternative approach).
    // For now, the [[ trigger detection works through the editor's onUpdate callback.

    return () => {
      setAutocompleteOpen(false);
    };
  }, [editor, handleSuggestionOpen, handleSuggestionClose]);

  // Handle note link autocomplete selection
  const handleAutocompleteSelect = useCallback((noteId: string, noteName: string) => {
    if (editor) {
      // Use the insertNoteLinkMention command
      editor.chain().focus().insertNoteLinkMention({ noteId, noteName }).run();
    }
    setAutocompleteOpen(false);
    setAutocompleteResults([]);
  }, [editor]);

  // Listen for [[ trigger in editor content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const text = editor.getText();
      const cursorPos = editor.state.selection.$from.parentOffset;
      const textBeforeCursor = editor.state.selection.$from.parent.textContent.slice(0, cursorPos);

      // Check if the user just typed [[
      if (textBeforeCursor.endsWith('[[')) {
        // Fetch notes for autocomplete
        fetchUserNotes('').then(results => {
          setAutocompleteOpen(true);
          setAutocompleteResults(results);
          autocompleteCallbackRef.current = handleAutocompleteSelect;

          if (typeof window !== 'undefined') {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              setAutocompletePosition({
                top: rect.bottom + 4,
                left: rect.left,
              });
            }
          }
        });
      } else if (autocompleteOpen && !textBeforeCursor.includes('[[')) {
        // Close autocomplete if [[ is no longer present
        setAutocompleteOpen(false);
        setAutocompleteResults([]);
      } else if (autocompleteOpen && textBeforeCursor.includes('[[')) {
        // Update search query
        const openBracketIndex = textBeforeCursor.lastIndexOf('[[');
        const query = textBeforeCursor.slice(openBracketIndex + 2).trim();
        fetchUserNotes(query).then(results => {
          setAutocompleteResults(results);
        });
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, autocompleteOpen, handleAutocompleteSelect]);

  // Listen for note-link-click custom events (from NoteLinkMentionView)
  useEffect(() => {
    const handleNoteLinkClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string; noteName: string }>;
      if (onNavigateToNote) {
        onNavigateToNote(customEvent.detail.noteId, customEvent.detail.noteName);
      }
    };

    document.addEventListener('note-link-click', handleNoteLinkClick);
    return () => document.removeEventListener('note-link-click', handleNoteLinkClick);
  }, [onNavigateToNote]);

  // Ctrl+S handler
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

  // beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current && editor) {
        const json = JSON.stringify(editor.getJSON());
        const payload = JSON.stringify({ contentJson: json });
        try {
          navigator.sendBeacon(`/api/nodes/${nodeId}`, new Blob([payload], { type: 'application/json' }));
        } catch {
          // sendBeacon not available
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editor, nodeId]);

  // Apply remote content updates from collab
  useEffect(() => {
    if (editor && latestContent) {
      try {
        const parsedRemoteContent = JSON.parse(latestContent);
        isApplyingRemoteUpdate.current = true;
        editor.commands.setContent(parsedRemoteContent);

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      } catch {
        // Failed to parse remote content
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
      className="flex flex-col gap-4"
    >
      {/* Editor container */}
      <div className="flex flex-col border rounded-lg bg-background">
        {/* Toolbar */}
        <EditorToolbar editor={editor} />

        {/* Save status indicator + Presence */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b">
          <div className="flex items-center gap-3">
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
              Ctrl+S to save · [[ to link a note
            </span>
          </div>
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-auto">
          <EditorContent editor={editor} className="tiptap-editor-content" />
        </div>
      </div>

      {/* NoteLink Autocomplete dropdown */}
      <NoteLinkAutocomplete
        isOpen={autocompleteOpen}
        results={autocompleteResults}
        onSelect={handleAutocompleteSelect}
        onClose={() => {
          setAutocompleteOpen(false);
          setAutocompleteResults([]);
        }}
        position={autocompletePosition}
      />

      {/* Backlink panel below the editor */}
      <BacklinkPanel
        nodeId={nodeId}
        onNavigateToNote={onNavigateToNote}
      />
    </motion.div>
  );
}

// ============================================================
// Helper: Fetch user's notes for autocomplete
// ============================================================

async function fetchUserNotes(query: string): Promise<Array<{ id: string; name: string; type: string }>> {
  try {
    const url = query
      ? `/api/search?q=${encodeURIComponent(query)}&type=note`
      : `/api/search?q=&type=note`; // Empty query returns recent notes

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) return [];

    if (data.data?.results) {
      return data.data.results
        .filter((r: Record<string, unknown>) => r.type === 'note')
        .map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          type: r.type as string,
        }));
    }

    return [];
  } catch {
    return [];
  }
}
