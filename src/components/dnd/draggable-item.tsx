'use client';

// ============================================================
// MODUL 23.6: DraggableItem — Desktop drag + Mobile long-press
// On mobile (<640px), long-press (500ms) triggers context menu
// On desktop, normal @dnd-kit drag behavior
// IMPORTANT: Hooks must be called before any conditional return
// ============================================================

import { useState, useCallback, useRef, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Move, Trash2, Share2, Pencil } from 'lucide-react';
import type { TreeNode } from '@/types';
import { useWorkspaceDnd } from './dnd-context';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from 'sonner';

interface DraggableItemProps {
  id: string;
  node: TreeNode;
  selectedNodes: TreeNode[];
  children: ReactNode;
  onAction?: (action: 'move' | 'delete' | 'share' | 'rename', node: TreeNode) => void;
}

export function DraggableItem({ id, node, selectedNodes, children, onAction }: DraggableItemProps) {
  const { activeDragId, isDragging, isMobile } = useWorkspaceDnd();
  const [longPressActive, setLongPressActive] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always call useDraggable hook (required before any conditional logic)
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
    disabled: isMobile, // Disable drag on mobile
  });

  // Handle long-press start (mobile only)
  const handleTouchStart = useCallback(() => {
    if (!isMobile) return;
    longPressTimerRef.current = setTimeout(() => {
      setLongPressActive(true);
    }, 500);
  }, [isMobile]);

  // Handle long-press cancel (mobile only)
  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle long-press move (cancel if finger moves)
  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressActive(false);
  }, []);

  // Handle context menu action
  const handleAction = useCallback((action: 'move' | 'delete' | 'share' | 'rename') => {
    setLongPressActive(false);
    if (onAction) {
      onAction(action, node);
    } else {
      switch (action) {
        case 'move':
          toast.info(`Move "${node.name}" — select destination`);
          break;
        case 'delete':
          toast.success(`"${node.name}" deleted`);
          break;
        case 'share':
          toast.info(`Share "${node.name}"`);
          break;
        case 'rename':
          toast.info(`Rename "${node.name}"`);
          break;
      }
    }
  }, [node, onAction]);

  // Mobile mode: long-press context menu (no drag behavior)
  if (isMobile) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`group/longpress relative ${longPressActive ? 'ring-2 ring-orange-500/50 bg-orange-50/30 dark:bg-orange-950/10' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
          >
            {longPressActive && (
              <div className="absolute inset-0 bg-orange-50/20 dark:bg-orange-950/10 rounded-lg pointer-events-none" />
            )}
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={() => handleAction('rename')}
            className="min-h-[44px]"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleAction('move')}
            className="min-h-[44px]"
          >
            <Move className="h-4 w-4 mr-2" />
            Move to...
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleAction('share')}
            className="min-h-[44px]"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleAction('delete')}
            className="text-destructive focus:text-destructive min-h-[44px]"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // Desktop mode: normal @dnd-kit drag behavior
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const isThisItemDragged = thisItemDragging || (isDragging && String(activeDragId) === id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/drag relative ${isThisItemDragged ? 'opacity-30' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle */}
      <div className="absolute top-1 left-1 opacity-0 group-hover/drag:opacity-100 transition-opacity z-10">
        <div className="flex items-center justify-center h-6 w-6 min-h-[44px] min-w-[44px] rounded bg-background/80 border border-border cursor-grab">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {children}
    </div>
  );
}
