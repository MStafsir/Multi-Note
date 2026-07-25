// ============================================================
// MODUL 46.1: Custom Tiptap Node — CodeSandboxBlock
// Different from CodeBlock (syntax-highlight-only, Modul 9.1):
//   CodeSandboxBlock is EXECUTABLE — runs code in sandboxed Worker+iframe
// 
// Attributes:
//   source: string — the code to execute
//   language: 'javascript' | 'typescript' — 46.3 language support
//   title: string — optional block title
//
// Registered via Node.create() with proper ProseMirror node spec
// ReactNodeViewRenderer wraps CodeSandboxPreview for execution UI
// Extends registry per Modul 9.1 convention (like MathBlockNode, EmbeddedFileNode)
// ============================================================

'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { CodeSandboxPreview } from './code-sandbox-preview';

// ============================================================
// React NodeView component for CodeSandbox rendering
// Wraps CodeSandboxPreview inside a ProseMirror NodeView
// ============================================================

interface CodeSandboxAttrs {
  source: string;
  language: 'javascript' | 'typescript';
  title: string;
}

function CodeSandboxNodeView({
  node,
  updateAttributes,
}: {
  node: { attrs: CodeSandboxAttrs };
  updateAttributes: (attrs: Partial<CodeSandboxAttrs>) => void;
}) {
  const { source, language, title } = node.attrs;

  const handleSourceChange = (newSource: string) => {
    updateAttributes({ source: newSource });
  };

  const handleLanguageChange = (newLanguage: 'javascript' | 'typescript') => {
    updateAttributes({ language: newLanguage });
  };

  const handleTitleChange = (newTitle: string) => {
    updateAttributes({ title: newTitle });
  };

  return (
    <NodeViewWrapper className="code-sandbox-block-node" draggable={false}>
      <CodeSandboxPreview
        source={source}
        language={language}
        title={title}
        onSourceChange={handleSourceChange}
        onLanguageChange={handleLanguageChange}
        onTitleChange={handleTitleChange}
      />
    </NodeViewWrapper>
  );
}

// ============================================================
// Tiptap custom Node extension — CodeSandboxBlock
// ============================================================

export const CodeSandboxBlockNode = Node.create({
  name: 'codeSandboxBlock',

  group: 'block',
  inline: false,
  atom: true, // Atom node — no editable content inside, rendered as single unit
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      source: {
        default: '// Write your code here\nconsole.log("Hello, sandbox!");',
        parseHTML: (element) => element.getAttribute('data-sandbox-source') || '',
        renderHTML: (attributes) => {
          if (!attributes.source) return {};
          return { 'data-sandbox-source': attributes.source as string };
        },
      },
      language: {
        default: 'javascript',
        parseHTML: (element) =>
          (element.getAttribute('data-sandbox-language') as 'javascript' | 'typescript') || 'javascript',
        renderHTML: (attributes) => {
          return { 'data-sandbox-language': (attributes.language as string) || 'javascript' };
        },
      },
      title: {
        default: 'Code Sandbox',
        parseHTML: (element) => element.getAttribute('data-sandbox-title') || 'Code Sandbox',
        renderHTML: (attributes) => {
          return { 'data-sandbox-title': (attributes.title as string) || 'Code Sandbox' };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-code-sandbox-block]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            source: el.getAttribute('data-sandbox-source') || '',
            language: el.getAttribute('data-sandbox-language') || 'javascript',
            title: el.getAttribute('data-sandbox-title') || 'Code Sandbox',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    return [
      'div',
      mergeAttributes(attrs, { 'data-code-sandbox-block': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeSandboxNodeView);
  },

  addCommands() {
    return {
      insertCodeSandboxBlock: (attrs: {
        source?: string;
        language?: 'javascript' | 'typescript';
        title?: string;
      }) => ({ chain }) => {
        const language = attrs.language || 'javascript';
        const source = attrs.source || '// Write your code here\nconsole.log("Hello, sandbox!");';
        const title = attrs.title || 'Code Sandbox';

        return chain()
          .focus()
          .insertContent({
            type: this.name,
            attrs: { source, language, title },
          })
          .run();
      },
    };
  },
});

// Type augmentation for Tiptap commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertCodeSandboxBlock: {
      /**
       * Insert a code sandbox block node with executable code
       */
      insertCodeSandboxBlock: (attrs: {
        source?: string;
        language?: 'javascript' | 'typescript';
        title?: string;
      }) => ReturnType;
    };
  }
}
