'use client';

import { type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { TreeNode } from '@/types';
import { useWorkspaceDnd } from './dnd-context';

// ============================================================
// DraggableItem — Wrapper for draggable grid/list items
// Shows drag handle on hover, passes node data in drag data
// ============================================================

interface DraggableItemProps {
  id: string;
  node: TreeNode;
  selectedNodes: TreeNode[];
  children: ReactNode;
}

export function DraggableItem({ id, node, selectedNodes, children }: DraggableItemProps) {
  const { activeDragId, isDragging } = useWorkspaceDnd();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: thisItemDragging,
  } = useDraggable({
    id,
    data: {
      node,
      selectedNodes,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Reduce opacity when this item is being dragged
  const isThisItemDragged = thisItemDragging || (isDragging && String(activeDragId) === id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/drag relative ${isThisItemDragged ? 'opacity-30' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle — visible on hover */}
      <div className="absolute top-1 left-1 opacity-0 group-hover/drag:opacity-100 transition-opacity z-10">
        <div className="flex items-center justify-center h-6 w-6 rounded bg-background/80 border border-border cursor-grab">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {children}
    </div>
  );
}
