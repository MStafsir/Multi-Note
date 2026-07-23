'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { File, FileText, Folder } from 'lucide-react';
import type { NodeType } from '@/types';

// ============================================================
// EmbeddedFileNode — Custom Tiptap node extension for embedded files
// Renders an inline card showing file icon + name + link
// ============================================================

// React component for the node view
function EmbeddedFileNodeView({ nodeAttrs }: { nodeAttrs: Record<string, string> }) {
  const { fileId, fileName, fileType } = nodeAttrs;

  const getIcon = () => {
    switch (fileType) {
      case 'folder':
        return <Folder className="h-4 w-4 text-orange-500 shrink-0" />;
      case 'note':
        return <FileText className="h-4 w-4 text-emerald-600 shrink-0" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <NodeViewWrapper className="embedded-file-node" draggable={false}>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 my-2 cursor-pointer hover:bg-accent/50 transition-colors"
        role="button"
        tabIndex={0}
        aria-label={`Open ${fileName}`}
        onClick={() => {
          // Placeholder: In Modul 9.3, this will open FilePreviewModal
          // For now, clicking embedded file cards is a no-op
        }}
      >
        {getIcon()}
        <span className="text-sm font-medium truncate">{fileName}</span>
        <span className="text-xs text-muted-foreground">{fileType}</span>
      </div>
    </NodeViewWrapper>
  );
}

export const EmbeddedFileNode = Node.create({
  name: 'embeddedFile',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      fileId: {
        default: null,
      },
      fileName: {
        default: null,
      },
      fileType: {
        default: 'file',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embedded-file]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-embedded-file': '',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => (
      <EmbeddedFileNodeView nodeAttrs={node.attrs as Record<string, string>} />
    ));
  },

  addCommands() {
    return {
      insertEmbeddedFile: (attrs: { fileId: string; fileName: string; fileType: NodeType }) => ({
        commands,
        chain,
      }) => {
        return chain().focus().insertContent({
          type: this.name,
          attrs,
        }).run();
      },
    };
  },
});
