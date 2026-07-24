// ============================================================
// MODUL 45.1: Custom Tiptap Node — MathBlock
// Supports two modes: inline ($...$) and block ($$...$$)
// Stores attrs: source (LaTeX string), displayMode ('inline' | 'block')
// Uses KaTeX for rendering (45.2) — synchronous, no CLS issues
// Registered via Node.create() with proper ProseMirror node spec
// ReactNodeViewRenderer wraps MathBlockPreview for live preview
// ============================================================

'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { MathBlockPreview } from './math-block-preview';

// ============================================================
// React NodeView component for MathBlock rendering
// Wraps MathBlockPreview (45.3) inside a ProseMirror NodeView
// ============================================================

interface MathBlockAttrs {
  source: string;
  displayMode: 'inline' | 'block';
}

function MathBlockNodeView({
  node,
  updateAttributes,
}: {
  node: { attrs: MathBlockAttrs };
  updateAttributes: (attrs: Partial<MathBlockAttrs>) => void;
}) {
  const { source, displayMode } = node.attrs;

  const handleSourceChange = (newSource: string) => {
    updateAttributes({ source: newSource });
  };

  // For inline mode, render as a span; for block mode, render as a div
  if (displayMode === 'inline') {
    return (
      <NodeViewWrapper className="math-block-node-inline" as="span" draggable={false}>
        <MathBlockPreview
          source={source}
          displayMode="inline"
          onSourceChange={handleSourceChange}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="math-block-node-block" draggable={false}>
      <MathBlockPreview
        source={source}
        displayMode="block"
        onSourceChange={handleSourceChange}
      />
    </NodeViewWrapper>
  );
}

// ============================================================
// Tiptap custom Node extension — MathBlock
// ============================================================

export const MathBlockNode = Node.create({
  name: 'mathBlock',

  // Block display by default; can also be inline when displayMode='inline'
  group: 'block inline',
  inline: false,
  atom: true, // Atom node — no editable content inside, rendered as single unit
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-math-source') || '',
        renderHTML: (attributes) => {
          if (!attributes.source) return {};
          return { 'data-math-source': attributes.source as string };
        },
      },
      displayMode: {
        default: 'block',
        parseHTML: (element) =>
          (element.getAttribute('data-math-display-mode') as 'inline' | 'block') || 'block',
        renderHTML: (attributes) => {
          return { 'data-math-display-mode': (attributes.displayMode as string) || 'block' };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            source: el.getAttribute('data-math-source') || '',
            displayMode: el.getAttribute('data-math-display-mode') || 'block',
          };
        },
      },
      {
        tag: 'span[data-math-block]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            source: el.getAttribute('data-math-source') || '',
            displayMode: el.getAttribute('data-math-display-mode') || 'inline',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    if (attrs['data-math-display-mode'] === 'inline') {
      return [
        'span',
        mergeAttributes(attrs, { 'data-math-block': '' }),
      ];
    }
    return [
      'div',
      mergeAttributes(attrs, { 'data-math-block': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockNodeView);
  },

  addCommands() {
    return {
      insertMathBlock: (attrs: { source?: string; displayMode?: 'inline' | 'block' }) => ({
        chain,
        commands,
      }) => {
        const displayMode = attrs.displayMode || 'block';
        const source = attrs.source || '';

        // For block mode, insert as a block node
        if (displayMode === 'block') {
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { source, displayMode: 'block' },
            })
            .run();
        }

        // For inline mode, insert as an inline node within text
        return commands.insertContent({
          type: this.name,
          attrs: { source, displayMode: 'inline' },
        });
      },
    };
  },
});

// Type augmentation for Tiptap commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertMathBlock: {
      /**
       * Insert a math block node with optional source and display mode
       */
      insertMathBlock: (attrs: {
        source?: string;
        displayMode?: 'inline' | 'block';
      }) => ReturnType;
    };
  }
}
