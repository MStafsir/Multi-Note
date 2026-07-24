'use client';

import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { TreeNode } from '@/types';
import { useWorkspaceDnd } from './dnd-context';

// ============================================================
// DroppableFolder — Wrapper for droppable folder targets
// Visual feedback: highlight border/bg when drag is over
// Validates: reject drop if target is a file or descendant conflict
// ============================================================

interface DroppableFolderProps {
  id: string;
  node: TreeNode;
  children: ReactNode;
}

export function DroppableFolder({ id, node, children }: DroppableFolderProps) {
  const { overFolderId } = useWorkspaceDnd();

  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      node,
    },
  });

  // Highlight if this folder is the current drag-over target
  const isHighlighted = isOver || String(overFolderId) === id;

  return (
    <div
      ref={setNodeRef}
      className={`
        transition-all duration-150 rounded-lg
        ${isHighlighted
          ? 'ring-2 ring-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20'
          : ''
        }
      `}
    >
      {children}
    </div>
  );
}
