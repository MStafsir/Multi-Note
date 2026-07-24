// ============================================================
// MODUL 31.1: DatabaseBlock Tiptap Node Extension
// Custom Tiptap node that embeds database_id reference in note content_json
// When rendered, it shows the DatabaseBlockRenderer component
// This keeps database as a rich-block inside content_json, NOT a new NodeType
// ============================================================

'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { DatabaseBlockRenderer } from '@/components/database/database-block-renderer';

// React node view for the database block
function DatabaseBlockNodeView({ nodeAttrs }: { nodeAttrs: { database_id: string } }) {
  const databaseId = nodeAttrs.database_id;

  return (
    <NodeViewWrapper className="database-block-node" draggable={false}>
      <DatabaseBlockRenderer databaseId={databaseId} />
    </NodeViewWrapper>
  );
}

// Tiptap custom node extension
// DatabaseBlock is a custom block-level node that stores a database_id reference
// The actual data lives in the note_databases table — only the ID is embedded in content_json
export const DatabaseBlockNode = Node.create({
  name: 'databaseBlock',
  group: 'block',
  atom: true, // Atom node — can't have children, renders as a single block
  selectable: true,
  draggable: false, // Prevent drag within editor — database blocks stay in place

  addAttributes() {
    return {
      database_id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-database-id'),
        renderHTML: (attributes) => {
          if (!attributes.database_id) return {};
          return { 'data-database-id': attributes.database_id };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-database-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-database-block': '',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => (
      <DatabaseBlockNodeView nodeAttrs={node.attrs as { database_id: string }} />
    ));
  },

  addCommands() {
    return {
      // Command to insert a database block at the current cursor position
      // Usage: editor.commands.insertDatabaseBlock('database_id_here')
      insertDatabaseBlock: (attrs: { database_id: string }) => ({
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
});
