'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, File, FileText, ChevronRight, ChevronDown, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import type { TreeNode } from '@/types';
import { useFileTreeStore } from '@/store/file-tree';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameDialog } from '@/components/workspace/rename-dialog';
import { useDeleteNode } from '@/hooks/use-file-tree';

interface FileTreeItemProps {
  node: TreeNode;
  depth: number;
}

export function FileTreeItem({ node, depth }: FileTreeItemProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const {
    selectedNodeIds,
    expandedFolderIds,
    selectNode,
    toggleFolderExpand,
    setCurrentFolder,
  } = useFileTreeStore();

  const deleteMutation = useDeleteNode();
  const isSelected = selectedNodeIds.has(node.id);
  const isExpanded = expandedFolderIds.has(node.id);
  const isFolder = node.type === 'folder';

  const getIcon = () => {
    switch (node.type) {
      case 'folder':
        return <Folder className="h-4 w-4 text-orange-500" />;
      case 'file':
        return <File className="h-4 w-4 text-muted-foreground" />;
      case 'note':
        return <FileText className="h-4 w-4 text-emerald-600" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const handleClick = () => {
    selectNode(node.id, 'single');

    if (isFolder) {
      // Navigate into folder
      const currentPath = useFileTreeStore.getState().currentFolderPath;
      const newPath = [...currentPath, { id: node.id, name: node.name }];
      setCurrentFolder(node.id, newPath);
      if (!isExpanded) {
        toggleFolderExpand(node.id);
      }
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolderExpand(node.id);
  };

  const handleDelete = () => {
    deleteMutation.mutate({ nodeId: node.id });
  };

  return (
    <>
      <div
        className={`
          group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer
          transition-colors text-sm
          ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isFolder ? isExpanded : undefined}
      >
        {/* Expand/collapse for folders */}
        {isFolder && (
          <button
            onClick={handleExpandClick}
            className="shrink-0 p-0.5 hover:bg-accent rounded"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {!isFolder && <span className="w-5 shrink-0" />}

        {/* Icon */}
        <span className="shrink-0">{getIcon()}</span>

        {/* Name */}
        <span className="truncate min-w-0 flex-1">{node.name}</span>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isFolder && isExpanded && node.children && node.children.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {node.children.map((child) => (
              <FileTreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        nodeId={node.id}
        currentName={node.name}
      />
    </>
  );
}
