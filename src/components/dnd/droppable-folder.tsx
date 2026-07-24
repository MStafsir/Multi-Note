'use client';

// ============================================================
// MODUL 23.6: DroppableFolder — Desktop drop target + Mobile passthrough
// IMPORTANT: Hooks must be called before any conditional return
// On mobile, disabled flag prevents drop behavior
// ============================================================

import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { TreeNode } from '@/types';
import { useWorkspaceDnd } from './dnd-context';

interface DroppableFolderProps {
  id: string;
  node: TreeNode;
  children: ReactNode;
}

export function DroppableFolder({ id, node, children }: DroppableFolderProps) {
  const { overFolderId, isMobile } = useWorkspaceDnd();

  // Always call useDroppable hook (required before any conditional logic)
  // Disabled on mobile so it doesn't interfere with long-press behavior
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      node,
    },
    disabled: isMobile,
  });

  // On mobile, no drop behavior — just render children as a plain wrapper
  if (isMobile) {
    return <div>{children}</div>;
  }

  // On desktop, use @dnd-kit droppable with visual feedback
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
