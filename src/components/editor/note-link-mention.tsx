// ============================================================
// MODUL 34.1: NoteLinkMention — Custom Tiptap Node extension
// Typing [[ triggers autocomplete dropdown showing user's notes
// Selected note creates a NoteLinkMention node with attrs: { noteId, noteName }
// Renders as inline styled link (clickable to navigate to referenced note)
// Broken links: strikethrough + gray color + tooltip "Note deleted"
// Extends the same pattern as EmbeddedFileNode (custom node with attrs)
// ============================================================

'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// React NodeView component for NoteLinkMention rendering
// ============================================================

interface NoteLinkMentionAttrs {
  noteId: string;
  noteName: string;
  isBroken?: boolean;
}

function NoteLinkMentionView({ nodeAttrs }: { nodeAttrs: NoteLinkMentionAttrs }) {
  const { noteId, noteName, isBroken } = nodeAttrs;

  if (isBroken) {
    return (
      <NodeViewWrapper className="note-link-mention" draggable={false} as="span">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs line-through text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
          title="This note has been deleted"
          aria-label={`Broken link to deleted note: ${noteName}`}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[150px]">{noteName}</span>
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="note-link-mention" draggable={false} as="span">
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 cursor-pointer transition-colors"
        role="link"
        tabIndex={0}
        aria-label={`Link to note: ${noteName}`}
        data-note-id={noteId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Navigate to the referenced note
          // Dispatch custom event that the workspace layout can listen to
          const event = new CustomEvent('note-link-click', {
            detail: { noteId, noteName },
            bubbles: true,
          });
          e.currentTarget.dispatchEvent(event);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const event = new CustomEvent('note-link-click', {
              detail: { noteId, noteName },
              bubbles: true,
            });
            e.currentTarget.dispatchEvent(event);
          }
        }}
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[150px]">{noteName}</span>
        <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
      </span>
    </NodeViewWrapper>
  );
}

// ============================================================
// Tiptap custom Node extension — NoteLinkMention
// ============================================================

export const NoteLinkMentionNode = Node.create({
  name: 'noteLinkMention',
  group: 'inline',
  inline: true,
  atom: true, // Atom node — can't edit content inside, renders as single inline element
  selectable: true,

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-id'),
        renderHTML: (attributes) => {
          if (!attributes.noteId) return {};
          return { 'data-note-id': attributes.noteId };
        },
      },
      noteName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-name'),
        renderHTML: (attributes) => {
          if (!attributes.noteName) return {};
          return { 'data-note-name': attributes.noteName };
        },
      },
      isBroken: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-broken') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.isBroken) return {};
          return { 'data-broken': 'true' };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-note-link-mention]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-note-link-mention': '',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => (
      <NoteLinkMentionView nodeAttrs={node.attrs as unknown as NoteLinkMentionAttrs} />
    ));
  },

  addCommands() {
    return {
      insertNoteLinkMention: (attrs: { noteId: string; noteName: string }) => ({
        commands,
        chain,
      }) => {
        return chain()
          .focus()
          .insertContent({
            type: this.name,
            attrs,
          })
          .run();
      },
    };
  },

  addInputRules() {
    return [
      // Input rule: typing [[ triggers a partial note link placeholder
      // The actual autocomplete dropdown is handled by the NoteLinkSuggestion extension
      // This input rule creates a temporary node that the suggestion can fill in
    ];
  },
});

// ============================================================
// NoteLink Autocomplete Suggestion — Detects [[ trigger
// Shows dropdown with fuzzy-searchable list of user's notes
// ============================================================

export const NOTE_LINK_SUGGESTION_KEY = new PluginKey('noteLinkSuggestion');

interface NoteSearchResult {
  id: string;
  name: string;
  type: string;
}

// The suggestion plugin watches for `[[` input and shows a popup
export function createNoteLinkSuggestionPlugin(
  editorInstance: unknown,
  onOpen: (results: NoteSearchResult[], callback: (noteId: string, noteName: string) => void) => void,
  onClose: () => void
) {
  return new Plugin({
    key: NOTE_LINK_SUGGESTION_KEY,
    state: {
      init() {
        return { active: false, query: '', startPos: null, callback: null };
      },
      apply(tr, prev, _oldState, newState) {
        // Check if the plugin state was explicitly updated
        const meta = tr.getMeta(NOTE_LINK_SUGGESTION_KEY);
        if (meta) {
          return meta;
        }

        // If the transaction changes the doc and suggestion is active, deactivate
        if (prev.active && tr.docChanged) {
          // Check if we're still inside the [[ trigger
          const $pos = newState.selection.$from;
          const textBefore = $pos.parent.textContent.slice(
            0,
            $pos.parentOffset
          );

          // If `[[` is no longer present, close the suggestion
          if (!textBefore.includes('[[')) {
            return { active: false, query: '', startPos: null, callback: null };
          }

          // Update query based on text after [[
          const openBracketIndex = textBefore.lastIndexOf('[[');
          const newQuery = textBefore.slice(openBracketIndex + 2).trim();

          return { ...prev, query: newQuery };
        }

        return prev;
      },
    },
    props: {
      handleKeyDown(view, event) {
        const state = NOTE_LINK_SUGGESTION_KEY.getState(view.state);
        if (!state?.active) return false;

        // Escape closes the suggestion
        if (event.key === 'Escape') {
          const tr = view.state.tr.setMeta(NOTE_LINK_SUGGESTION_KEY, {
            active: false,
            query: '',
            startPos: null,
            callback: null,
          });
          view.dispatch(tr);
          onClose();
          return true;
        }

        return false;
      },
      handleTextInput(view, _from, _to, text) {
        const $pos = view.state.selection.$from;
        const textBefore = $pos.parent.textContent.slice(
          0,
          $pos.parentOffset
        ) + text;

        // Check if the user just typed [[
        if (textBefore.endsWith('[[')) {
          const startPos = $pos.pos - 1; // Position of the second [

          // Trigger the autocomplete search
          const insertCallback = (noteId: string, noteName: string) => {
            // Delete the [[ trigger text and insert the NoteLinkMention node
            const deleteFrom = startPos;
            const deleteTo = $pos.pos + text.length;

            const tr = view.state.tr.deleteRange(deleteFrom, deleteTo);
            view.dispatch(tr);

            // Insert the NoteLinkMention node
            const node = view.state.schema.nodes.noteLinkMention.create({
              noteId,
              noteName,
            });
            const insertTr = view.state.tr.insert(view.state.selection.$from.pos, node);
            view.dispatch(insertTr);

            // Close the suggestion
            const closeTr = view.state.tr.setMeta(NOTE_LINK_SUGGESTION_KEY, {
              active: false,
              query: '',
              startPos: null,
              callback: null,
            });
            view.dispatch(closeTr);
            onClose();
          };

          // Fetch notes for autocomplete
          fetchUserNotes('').then(results => {
            onOpen(results, insertCallback);

            const tr = view.state.tr.setMeta(NOTE_LINK_SUGGESTION_KEY, {
              active: true,
              query: '',
              startPos,
              callback: insertCallback,
            });
            view.dispatch(tr);
          });

          return false; // Don't prevent the text input
        }

        // If suggestion is active, update the query
        const state = NOTE_LINK_SUGGESTION_KEY.getState(view.state);
        if (state?.active) {
          const updatedQuery = textBefore.slice(
            textBefore.lastIndexOf('[[') + 2
          ).trim();

          fetchUserNotes(updatedQuery).then(results => {
            onOpen(results, state.callback || (() => {}));
          });

          return false;
        }

        return false;
      },
    },
  });
}

// ============================================================
// Helper: Fetch user's notes for autocomplete
// ============================================================

async function fetchUserNotes(query: string): Promise<NoteSearchResult[]> {
  try {
    const url = query
      ? `/api/search?q=${encodeURIComponent(query)}&type=note`
      : `/api/nodes`; // If no query, get all notes

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) return [];

    // From search API
    if (data.data?.results) {
      return data.data.results
        .filter((r: Record<string, unknown>) => r.type === 'note')
        .map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          type: r.type as string,
        }));
    }

    // From nodes API (list all)
    if (Array.isArray(data.data)) {
      return data.data
        .filter((n: Record<string, unknown>) => n.type === 'note' && !n.deletedAt)
        .map((n: Record<string, unknown>) => ({
          id: n.id as string,
          name: n.name as string,
          type: n.type as string,
        }));
    }

    return [];
  } catch {
    return [];
  }
}

// ============================================================
// NoteLinkAutocomplete — React component for the dropdown
// Used externally by TiptapEditor to render the autocomplete popup
// ============================================================

interface NoteLinkAutocompleteProps {
  isOpen: boolean;
  results: NoteSearchResult[];
  onSelect: (noteId: string, noteName: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function NoteLinkAutocomplete({
  isOpen,
  results,
  onSelect,
  onClose,
  position,
}: NoteLinkAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Clamp selected index to valid range (computed from state, no effect needed)
  const clampedIndex = results.length > 0
    ? Math.min(selectedIndex, results.length - 1)
    : 0;

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[clampedIndex]) {
          onSelect(results[clampedIndex].id, results[clampedIndex].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, results, clampedIndex, onSelect, onClose]);

  // Register keyboard handler
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || results.length === 0) return null;

  const style = position
    ? { top: position.top, left: position.left }
    : { top: 0, left: 0 };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          ref={listRef}
          className="fixed z-50 w-64 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
          style={style}
          role="listbox"
          aria-label="Select a note to link"
        >
          <div className="p-2 text-xs text-muted-foreground border-b">
            Link to note — type to search
          </div>
          <div className="p-1">
            {results.slice(0, 20).map((result, index) => (
              <button
                key={result.id}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
                  index === clampedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
                role="option"
                aria-selected={index === clampedIndex}
                onClick={() => onSelect(result.id, result.name)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{result.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
