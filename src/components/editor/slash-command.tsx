'use client';

import { useEffect, useState, useCallback } from 'react';
import { create } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import {
  type Extension,
  type Editor,
  type Range,
} from '@tiptap/core';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code2,
  Table as TableIcon,
  Minus,
  Quote,
  FileText,
  Calculator,
  Sigma,
  Play,
  Box,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculator';

// ============================================================
// Slash Command Extension — Shows dropdown when user types "/"
// ============================================================

// Block type definitions
interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor, range: Range) => void;
}

const slashCommands: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'heading1',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'heading2',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'heading3',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: 'bulletList',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Ordered List',
    description: 'Create a numbered list',
    icon: 'orderedList',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Add tasks with checkboxes',
    icon: 'taskList',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Insert a code block',
    icon: 'codeBlock',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    description: 'Insert a quote block',
    icon: 'blockquote',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Table',
    description: 'Insert a 3x3 table',
    icon: 'table',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Horizontal Rule',
    description: 'Insert a divider line',
    icon: 'horizontalRule',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Paragraph',
    description: 'Just start writing plain text',
    icon: 'paragraph',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Calculator Result',
    description: 'Insert calculator result (opens calculator if no result)',
    icon: 'calculator',
    command: (editor, range) => {
      // Get calculator result from store — if result exists, insert it inline
      const calcState = useCalculatorStore.getState();
      if (calcState.result) {
        editor.chain().focus().deleteRange(range).setParagraph().run();
        editor.chain().focus().insertContent(`= ${calcState.result}`).run();
      } else {
        // No result — open the calculator widget for user to compute first
        useCalculatorStore.getState().toggleOpen();
        editor.chain().focus().deleteRange(range).setParagraph().run();
      }
    },
  },
  {
    title: 'Math',
    description: 'Inline math expression ($...$)',
    icon: 'mathInline',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertMathBlock({ source: '', displayMode: 'inline' }).run();
    },
  },
  {
    title: 'Math Block',
    description: 'Block math expression ($$...$$)',
    icon: 'mathBlock',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertMathBlock({ source: '', displayMode: 'block' }).run();
    },
  },
  // MODUL 46.1 — CodeSandboxBlock slash command (extend registry per 9.4)
  {
    title: 'Code Sandbox',
    description: 'Executable JavaScript/TypeScript block (sandboxed)',
    icon: 'codeSandbox',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertCodeSandboxBlock({ source: '', language: 'javascript' }).run();
    },
  },
];

// Icon component for slash command menu
function CommandIcon({ name }: { name: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    heading1: <Heading1 className="h-4 w-4 text-orange-500" />,
    heading2: <Heading2 className="h-4 w-4 text-orange-500" />,
    heading3: <Heading3 className="h-4 w-4 text-orange-500" />,
    bulletList: <List className="h-4 w-4 text-muted-foreground" />,
    orderedList: <ListOrdered className="h-4 w-4 text-muted-foreground" />,
    taskList: <CheckSquare className="h-4 w-4 text-emerald-600" />,
    codeBlock: <Code2 className="h-4 w-4 text-muted-foreground" />,
    blockquote: <Quote className="h-4 w-4 text-muted-foreground" />,
    table: <TableIcon className="h-4 w-4 text-muted-foreground" />,
    horizontalRule: <Minus className="h-4 w-4 text-muted-foreground" />,
    paragraph: <FileText className="h-4 w-4 text-muted-foreground" />,
    calculator: <Calculator className="h-4 w-4 text-orange-500" />,
    mathInline: <Sigma className="h-4 w-4 text-emerald-600" />,
    mathBlock: <Sigma className="h-4 w-4 text-emerald-600" />,
    codeSandbox: <Play className="h-4 w-4 text-orange-500" />,
  };

  return <span className="shrink-0">{iconMap[name] || <FileText className="h-4 w-4" />}</span>;
}

// React component for the slash command popup
function SlashCommandList({
  items,
  command,
  selectedIndex,
}: {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  selectedIndex: number;
}) {
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden w-64">
      <AnimatePresence>
        {items.length > 0 ? (
          <div className="max-h-[280px] overflow-y-auto p-1">
            {items.map((item, index) => (
              <motion.button
                key={item.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-left transition-colors min-h-[44px]
                  ${index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                  }
                `}
                onClick={() => command(item)}
                aria-label={item.title}
              >
                <CommandIcon name={item.icon} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No results found
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tiptap extension
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      {
        key: 'slashCommandPlugin',
        plugin: (() => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            // Handle keydown events for filtering and selecting
            props: {
              handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
                if (!component || !popup) return false;

                const tippyPopup = popup[0];
                if (!tippyPopup || !tippyPopup.state?.isVisible) return false;

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  const currentIdx = component.props.selectedIndex;
                  const newIdx = currentIdx > 0 ? currentIdx - 1 : component.props.items.length - 1;
                  component.updateProps({ selectedIndex: newIdx });
                  return true;
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  const currentIdx = component.props.selectedIndex;
                  const newIdx = currentIdx < component.props.items.length - 1 ? currentIdx + 1 : 0;
                  component.updateProps({ selectedIndex: newIdx });
                  return true;
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  const selected = component.props.items[component.props.selectedIndex];
                  if (selected) {
                    component.props.command(selected);
                  }
                  return true;
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  tippyPopup.hide();
                  return true;
                }

                return false;
              },
            },

            // Watch for "/" character at the start of a line
            handleTextInput: (_view: unknown, _from: number, _to: number, text: string) => {
              if (text !== '/') return false;

              const editor = this.editor as Editor;
              const { $from } = editor.state.selection;

              // Only trigger at start of line or after a space
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
              if (textBefore.length > 0 && textBefore !== '') {
                // Allow "/" after space or at very start
                const lastChar = textBefore[textBefore.length - 1];
                if (lastChar !== ' ' && textBefore.length !== 0) return false;
              }

              const range: Range = {
                from: $from.pos - textBefore.length,
                to: $from.pos,
              };

              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: slashCommands,
                  selectedIndex: 0,
                  command: (item: SlashCommandItem) => {
                    item.command(editor, range);
                    if (popup) {
                      popup[0].hide();
                    }
                    component = null;
                    popup = null;
                  },
                },
                editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: () => {
                  const { from } = range;
                  const domRect = editor.view.coordsAtPos(from);
                  return domRect as DOMRect;
                },
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });

              return false;
            },

            // Filter items when typing after "/"
            handleKeyPress: (_view: unknown, event: KeyboardEvent) => {
              if (!component || !popup) return false;
              const tippyPopup = popup[0];
              if (!tippyPopup || !tippyPopup.state?.isVisible) return false;

              const query = (component.props.query || '') + event.key;
              const filtered = slashCommands.filter((item) =>
                item.title.toLowerCase().startsWith(query.toLowerCase())
              );

              component.updateProps({
                items: filtered,
                selectedIndex: 0,
                query,
              });

              return false;
            },

            // Clean up on blur
            destroy() {
              if (popup) {
                popup.forEach((p) => p.destroy());
              }
              if (component) {
                component.destroy();
              }
            },
          };
        })(),
      },
    ];
  },
});
