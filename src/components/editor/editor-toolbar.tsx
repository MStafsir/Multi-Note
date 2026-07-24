'use client';

// ============================================================
// MODUL 23.3: EditorToolbar — Mobile FAB + desktop toolbar
// On mobile (<640px), toolbar collapses to a FAB at bottom-right
// that expands on tap showing toolbar in a horizontal bar above FAB
// On desktop, shows the full toolbar inline
// IMPORTANT: Hooks must be called before any conditional return
// ============================================================

import { useState, useEffect, useCallback, type Editor } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code2,
  Table as TableIcon,
  Image as ImageIcon,
  Minus,
  Quote,
  PenLine,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MOBILE_BREAKPOINT = 640;

interface EditorToolbarProps {
  editor: Editor;
}

// Toolbar action items (shared between desktop and mobile)
const TOOLBAR_ITEMS = {
  textFormatting: [
    { icon: Bold, label: 'Bold', actionKey: 'bold', actionArgs: {} },
    { icon: Italic, label: 'Italic', actionKey: 'italic', actionArgs: {} },
    { icon: Strikethrough, label: 'Strikethrough', actionKey: 'strike', actionArgs: {} },
  ],
  headings: [
    { icon: Heading1, label: 'Heading 1', actionKey: 'heading', actionArgs: { level: 1 } },
    { icon: Heading2, label: 'Heading 2', actionKey: 'heading', actionArgs: { level: 2 } },
    { icon: Heading3, label: 'Heading 3', actionKey: 'heading', actionArgs: { level: 3 } },
  ],
  lists: [
    { icon: List, label: 'Bullet list', actionKey: 'bulletList', actionArgs: {} },
    { icon: ListOrdered, label: 'Ordered list', actionKey: 'orderedList', actionArgs: {} },
    { icon: CheckSquare, label: 'Task list', actionKey: 'taskList', actionArgs: {} },
  ],
  inserts: [
    { icon: TableIcon, label: 'Insert table', actionKey: 'table', actionArgs: {} },
    { icon: ImageIcon, label: 'Insert image', actionKey: 'image', actionArgs: {} },
    { icon: Minus, label: 'Horizontal rule', actionKey: 'horizontalRule', actionArgs: {} },
  ],
  codeBlocks: [
    { icon: Quote, label: 'Blockquote', actionKey: 'blockquote', actionArgs: {} },
    { icon: Code2, label: 'Code block', actionKey: 'codeBlock', actionArgs: {} },
  ],
};

type ToolbarItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  actionKey: string;
  actionArgs: Record<string, unknown>;
};

// Execute a toolbar action on the editor
function executeAction(editor: Editor, item: ToolbarItem) {
  switch (item.actionKey) {
    case 'bold':
      editor.chain().focus().toggleBold().run();
      break;
    case 'italic':
      editor.chain().focus().toggleItalic().run();
      break;
    case 'strike':
      editor.chain().focus().toggleStrike().run();
      break;
    case 'heading':
      editor.chain().focus().toggleHeading({ level: item.actionArgs.level as number }).run();
      break;
    case 'bulletList':
      editor.chain().focus().toggleBulletList().run();
      break;
    case 'orderedList':
      editor.chain().focus().toggleOrderedList().run();
      break;
    case 'taskList':
      editor.chain().focus().toggleTaskList().run();
      break;
    case 'blockquote':
      editor.chain().focus().toggleBlockquote().run();
      break;
    case 'codeBlock':
      editor.chain().focus().toggleCodeBlock().run();
      break;
    case 'horizontalRule':
      editor.chain().focus().setHorizontalRule().run();
      break;
    case 'table':
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case 'image':
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
      break;
  }
}

// Check if a toolbar action is active
function isActionActive(editor: Editor, item: ToolbarItem): boolean {
  switch (item.actionKey) {
    case 'heading':
      return editor.isActive('heading', { level: item.actionArgs.level as number });
    case 'table':
      return editor.isActive('table');
    case 'image':
      return editor.isActive('image');
    default:
      return editor.isActive(item.actionKey);
  }
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  // Hooks must be called before any conditional logic
  const [isMobile, setIsMobile] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!editor) return null;

  // All items flattened for mobile FAB
  const allItems: ToolbarItem[] = [
    ...TOOLBAR_ITEMS.textFormatting,
    ...TOOLBAR_ITEMS.headings,
    ...TOOLBAR_ITEMS.lists,
    ...TOOLBAR_ITEMS.inserts,
    ...TOOLBAR_ITEMS.codeBlocks,
  ];

  // ===== Desktop: Full inline toolbar =====
  if (!isMobile) {
    const renderGroup = (items: ToolbarItem[]) => (
      <div className="flex items-center gap-0.5">
        {items.map((item) => (
          <TooltipProvider key={item.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isActionActive(editor, item) ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 min-h-[44px] min-w-[44px]"
                  onClick={() => executeAction(editor, item)}
                  aria-label={item.label}
                  aria-pressed={isActionActive(editor, item)}
                >
                  <item.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );

    return (
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
        {renderGroup(TOOLBAR_ITEMS.textFormatting)}
        <Separator orientation="vertical" className="h-6 mx-1" />
        {renderGroup(TOOLBAR_ITEMS.headings)}
        <Separator orientation="vertical" className="h-6 mx-1" />
        {renderGroup(TOOLBAR_ITEMS.lists)}
        <Separator orientation="vertical" className="h-6 mx-1" />
        {renderGroup(TOOLBAR_ITEMS.inserts)}
        <Separator orientation="vertical" className="h-6 mx-1" />
        {renderGroup(TOOLBAR_ITEMS.codeBlocks)}
      </div>
    );
  }

  // ===== Mobile: FAB pattern =====
  return (
    <>
      {/* Expanded toolbar bar (above FAB) */}
      <AnimatePresence>
        {fabExpanded && (
          <>
            {/* Semi-transparent backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => setFabExpanded(false)}
            />

            {/* Toolbar bar */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-4 z-50 bg-background border border-border rounded-xl shadow-xl p-2 max-w-[calc(100vw-32px)] overflow-x-auto"
            >
              <div className="flex items-center gap-1 flex-wrap">
                {allItems.map((item) => (
                  <Button
                    key={item.label}
                    variant={isActionActive(editor, item) ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px]"
                    onClick={() => {
                      executeAction(editor, item);
                    }}
                    aria-label={item.label}
                    aria-pressed={isActionActive(editor, item)}
                  >
                    <item.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 min-h-[44px] min-w-[44px] rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-lg flex items-center justify-center"
        onClick={() => setFabExpanded(!fabExpanded)}
        aria-label={fabExpanded ? 'Close formatting toolbar' : 'Open formatting toolbar'}
      >
        <AnimatePresence mode="wait">
          {fabExpanded ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <PenLine className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
