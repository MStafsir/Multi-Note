'use client';

import { type Editor } from '@tiptap/react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================
// EditorToolbar — Formatting toolbar with grouped sections
// ============================================================

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  // Toolbar sections
  const textFormatting = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: Strikethrough,
      label: 'Strikethrough',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
    },
  ];

  const headings = [
    {
      icon: Heading1,
      label: 'Heading 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      icon: Heading3,
      label: 'Heading 3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
    },
  ];

  const lists = [
    {
      icon: List,
      label: 'Bullet list',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered,
      label: 'Ordered list',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      icon: CheckSquare,
      label: 'Task list',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
    },
  ];

  const inserts = [
    {
      icon: TableIcon,
      label: 'Insert table',
      action: insertTable,
      isActive: editor.isActive('table'),
    },
    {
      icon: ImageIcon,
      label: 'Insert image',
      action: addImage,
      isActive: editor.isActive('image'),
    },
    {
      icon: Minus,
      label: 'Horizontal rule',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
    },
  ];

  const codeBlocks = [
    {
      icon: Quote,
      label: 'Blockquote',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
    {
      icon: Code2,
      label: 'Code block',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
    },
  ];

  const renderGroup = (items: typeof textFormatting, showOnMobile = true) => (
    <div className={`flex items-center gap-0.5 ${!showOnMobile ? 'hidden md:flex' : ''}`}>
      {items.map((item) => (
        <TooltipProvider key={item.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={item.isActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 min-h-[32px] min-w-[32px]"
                onClick={item.action}
                aria-label={item.label}
                aria-pressed={item.isActive}
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
      {/* Text formatting */}
      {renderGroup(textFormatting)}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings — collapsed on small screens */}
      {renderGroup(headings, false)}

      <Separator orientation="vertical" className="h-6 mx-1 hidden md:block" />

      {/* Lists */}
      {renderGroup(lists)}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Insert */}
      {renderGroup(inserts, false)}

      <Separator orientation="vertical" className="h-6 mx-1 hidden md:block" />

      {/* Code */}
      {renderGroup(codeBlocks)}
    </div>
  );
}
