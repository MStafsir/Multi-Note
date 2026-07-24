'use client';

// ============================================================
// MODUL 18.2: Bulk Move Dialog — Folder picker for bulk move
// Shows folder tree for selecting target folder
// Cycle detection: warn if moving folder into its descendant
// "Move X items to [folder name]" confirm button
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderInput,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Home,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFileTreeStore } from '@/store/file-tree';
import type { TreeNode } from '@/types';

interface BulkMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeIds: string[];
  selectedNodes: TreeNode[];
  onConfirm: (targetFolderId: string | null, targetFolderName: string) => void;
  isPending: boolean;
}

export function BulkMoveDialog({
  open,
  onOpenChange,
  nodeIds,
  selectedNodes,
  onConfirm,
  isPending,
}: BulkMoveDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedTargetName, setSelectedTargetName] = useState<string>('Root (My Workspace)');
  const [cycleWarning, setCycleWarning] = useState<string | null>(null);

  const { tree, flatNodes } = useFileTreeStore();

  // Check for cycles: can't move a folder into itself or its descendants
  const validateTarget = (targetId: string | null) => {
    setCycleWarning(null);

    if (targetId === null) {
      // Moving to root is always safe
      setSelectedTargetId(null);
      setSelectedTargetName('Root (My Workspace)');
      return;
    }

    // Check if target is one of the selected nodes
    if (nodeIds.includes(targetId)) {
      setCycleWarning('Cannot move items into one of the selected items itself.');
      setSelectedTargetId(targetId);
      setSelectedTargetName(flatNodes.get(targetId)?.name || 'Unknown');
      return;
    }

    // Check if target is a descendant of any selected folder
    for (const node of selectedNodes) {
      if (node.type === 'folder') {
        const isDescendant = checkIsDescendant(targetId, node.id, flatNodes);
        if (isDescendant) {
          setCycleWarning(`Cannot move into "${flatNodes.get(targetId)?.name}" — it's inside "${node.name}" which is being moved.`);
          break;
        }
      }
    }

    setSelectedTargetId(targetId);
    setSelectedTargetName(flatNodes.get(targetId)?.name || 'Unknown');
  };

  const handleConfirm = () => {
    onConfirm(selectedTargetId, selectedTargetName);
  };

  // Get only folder nodes from the tree for the picker
  const folderTree = getOnlyFolders(tree);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Move {nodeIds.length} items
          </DialogTitle>
          <DialogDescription>
            Select a destination folder for the selected items.
          </DialogDescription>
        </DialogHeader>

        {/* Selected items preview */}
        <div className="p-2 bg-muted rounded-md">
          <ScrollArea className="max-h-20">
            <div className="flex flex-wrap gap-1">
              {selectedNodes.slice(0, 6).map(node => (
                <Badge key={node.id} variant="outline" className="text-xs truncate max-w-[100px]">
                  {node.name}
                </Badge>
              ))}
              {selectedNodes.length > 6 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{selectedNodes.length - 6} more
                </Badge>
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Folder picker tree */}
        <div className="flex-1 min-h-0">
          <Label className="text-sm font-medium mb-2">Select destination folder</Label>

          {/* Root option */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors
              ${selectedTargetId === null ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'hover:bg-muted/50'}
            `}
            onClick={() => validateTarget(null)}
          >
            <Home className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Root (My Workspace)</span>
          </div>

          {/* Folder tree */}
          <ScrollArea className="h-[250px] mt-1">
            <div className="py-1">
              {folderTree.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No folders available</p>
              )}
              {folderTree.map(folder => (
                <FolderPickerItem
                  key={folder.id}
                  node={folder}
                  depth={0}
                  selectedTargetId={selectedTargetId}
                  onSelect={validateTarget}
                  disabledIds={nodeIds}
                  cycleWarning={cycleWarning}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Cycle warning */}
        <AnimatePresence>
          {cycleWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{cycleWarning}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !!cycleWarning}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FolderInput className="h-4 w-4 mr-1" />
            )}
            Move {nodeIds.length} items to {selectedTargetName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Folder Picker Item ---
// Recursive component for rendering folder tree items in the picker

interface FolderPickerItemProps {
  node: TreeNode;
  depth: number;
  selectedTargetId: string | null;
  onSelect: (id: string | null) => void;
  disabledIds: string[];
  cycleWarning: string | null;
}

function FolderPickerItem({
  node,
  depth,
  selectedTargetId,
  onSelect,
  disabledIds,
  cycleWarning,
}: FolderPickerItemProps) {
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const isDisabled = disabledIds.includes(node.id);
  const isSelected = selectedTargetId === node.id;
  const hasCycleIssue = cycleWarning && isDisabled;
  const childFolders = getOnlyFolders(node.children || []);

  return (
    <div role="treeitem" aria-selected={isSelected}>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors
          ${isSelected ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'hover:bg-muted/50'}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isDisabled && onSelect(node.id)}
      >
        {/* Expand/collapse */}
        {childFolders.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="shrink-0 p-0.5 hover:bg-accent rounded min-h-[20px] min-w-[20px] flex items-center justify-center"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Folder icon */}
        <Folder className={`h-4 w-4 shrink-0 ${hasCycleIssue ? 'text-red-500' : 'text-orange-500'}`} />

        {/* Name */}
        <span className={`text-sm truncate min-w-0 flex-1 ${hasCycleIssue ? 'text-red-500' : ''}`}>
          {node.name}
        </span>

        {/* Disabled indicator */}
        {isDisabled && (
          <Badge variant="destructive" className="text-xs shrink-0">
            Moving
          </Badge>
        )}
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {expanded && childFolders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {childFolders.map(child => (
              <FolderPickerItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedTargetId={selectedTargetId}
                onSelect={onSelect}
                disabledIds={disabledIds}
                cycleWarning={cycleWarning}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper: Label component (avoid importing from ui/label for inline use) ---
function Label({ className, children, ...props }: React.ComponentProps<'label'>) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  );
}

// --- Helper: Check if targetId is a descendant of ancestorId ---
function checkIsDescendant(targetId: string, ancestorId: string, flatNodes: Map<string, TreeNode>): boolean {
  const ancestor = flatNodes.get(ancestorId);
  if (!ancestor) return false;

  // Recursively check all descendants
  const checkChildren = (node: TreeNode): boolean => {
    if (node.id === targetId) return true;
    if (node.children) {
      for (const child of node.children) {
        if (checkChildren(child)) return true;
      }
    }
    return false;
  };

  return checkChildren(ancestor);
}

// --- Helper: Filter tree to show only folder nodes ---
function getOnlyFolders(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .filter(n => n.type === 'folder')
    .map(n => ({
      ...n,
      children: getOnlyFolders(n.children || []),
    }));
}
