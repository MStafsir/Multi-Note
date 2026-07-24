'use client';

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import {
  DndContext as DndKitContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Folder, File, FileText } from 'lucide-react';
import type { TreeNode, NodeType } from '@/types';
import { useMoveNode } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';
import { toast } from 'sonner';

// ============================================================
// DnD Context — Shared state for drag operations across workspace
// ============================================================

interface DragData {
  node: TreeNode;
  selectedNodes: TreeNode[];
}

interface DndContextValue {
  activeDragId: UniqueIdentifier | null;
  activeDragData: DragData | null;
  overFolderId: UniqueIdentifier | null;
  isDragging: boolean;
}

const WorkspaceDndContext = createContext<DndContextValue>({
  activeDragId: null,
  activeDragData: null,
  overFolderId: null,
  isDragging: false,
});

export function useWorkspaceDnd() {
  return useContext(WorkspaceDndContext);
}

// Helper: Check if a node is a descendant of another node
function isDescendantOf(nodeId: string, potentialAncestorId: string, flatNodes: Map<string, TreeNode>): boolean {
  let currentId: string | null = nodeId;
  while (currentId) {
    if (currentId === potentialAncestorId) return true;
    const node = flatNodes.get(currentId);
    if (!node) break;
    currentId = node.parentId;
  }
  return false;
}

// Helper: Get icon for node type
function getNodeIcon(type: NodeType) {
  switch (type) {
    case 'folder':
      return <Folder className="h-5 w-5 text-orange-500" />;
    case 'file':
      return <File className="h-5 w-5 text-muted-foreground" />;
    case 'note':
      return <FileText className="h-5 w-5 text-emerald-600" />;
  }
}

// Drag Overlay Preview Component
function DragOverlayPreview({ data }: { data: DragData }) {
  const { node, selectedNodes } = data;
  const count = selectedNodes.length;

  return (
    <motion.div
      initial={{ opacity: 0.8, scale: 0.95 }}
      animate={{ opacity: 0.9, scale: 1 }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border shadow-lg"
    >
      {getNodeIcon(node.type)}
      <span className="text-sm font-medium truncate max-w-[200px]">
        {node.name}
      </span>
      {count > 1 && (
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          +{count - 1} more
        </span>
      )}
    </motion.div>
  );
}

interface WorkspaceDndProviderProps {
  children: ReactNode;
}

export function WorkspaceDndProvider({ children }: WorkspaceDndProviderProps) {
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [overFolderId, setOverFolderId] = useState<UniqueIdentifier | null>(null);

  const moveMutation = useMoveNode();
  const { flatNodes, selectedNodeIds } = useFileTreeStore();

  // Sensors — PointerSensor with distance constraint for mobile, KeyboardSensor for accessibility
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, keyboardSensor);

  // onDragStart — capture the dragged item's data
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const dragData = active.data.current as DragData | undefined;

    if (dragData) {
      setActiveDragId(active.id);
      setActiveDragData(dragData);
    }
  }, []);

  // onDragOver — highlight target folder for visual feedback
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Check if the over target is a folder (not a file)
      const overNode = flatNodes.get(String(over.id));
      if (overNode && overNode.type === 'folder') {
        setOverFolderId(over.id);
      } else {
        setOverFolderId(null);
      }
    } else {
      setOverFolderId(null);
    }
  }, [flatNodes]);

  // onDragEnd — perform the move operation
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveDragId(null);
    setActiveDragData(null);
    setOverFolderId(null);

    if (!over || !active.data.current) return;

    const dragData = active.data.current as DragData;
    const { node, selectedNodes } = dragData;

    // Determine target folder
    const overId = String(over.id);
    const overNode = flatNodes.get(overId);

    // Reject if target is a file (not a folder)
    if (overNode && overNode.type !== 'folder') {
      toast.error('Cannot move items into a file');
      return;
    }

    // Reject if dragged item is being dropped into itself
    if (active.id === over.id) return;

    // Reject if dragged item is a descendant of target (would create circular reference)
    const targetFolderId = overNode ? overNode.id : null;

    // Move all selected items (or just the dragged one if no multi-selection)
    const itemsToMove = selectedNodes.length > 0 ? selectedNodes : [node];

    for (const item of itemsToMove) {
      // Skip if item is the target folder itself or a descendant
      if (isDescendantOf(item.id, overId, flatNodes)) {
        toast.error(`Cannot move "${item.name}" into one of its descendants`);
        continue;
      }

      // Skip if already in this folder
      if (item.parentId === targetFolderId) continue;

      try {
        await moveMutation.mutateAsync({
          nodeId: item.id,
          newParentId: targetFolderId,
        });
      } catch {
        // Error is handled by mutation's onError
      }
    }
  }, [flatNodes, moveMutation]);

  // onDragCancel — reset state
  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveDragData(null);
    setOverFolderId(null);
  }, []);

  const contextValue: DndContextValue = {
    activeDragId,
    activeDragData,
    overFolderId,
    isDragging: activeDragId !== null,
  };

  return (
    <WorkspaceDndContext.Provider value={contextValue}>
      <DndKitContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDragData ? (
            <DragOverlayPreview data={activeDragData} />
          ) : null}
        </DragOverlay>
      </DndKitContext>
    </WorkspaceDndContext.Provider>
  );
}
