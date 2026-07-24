'use client';

import { Fragment, useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  File,
  FileText,
  ChevronRight,
  Grid3X3,
  List,
  ArrowUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Share2,
  History,
} from 'lucide-react';
import type { TreeNode, NodeType } from '@/types';
import { useFileTreeStore } from '@/store/file-tree';
import { Button } from '@/components/ui/button';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UploadZone } from '@/components/upload/upload-zone';
import { RenameDialog } from './rename-dialog';
import { NoteEditor } from './note-editor';
import { useDeleteNode } from '@/hooks/use-file-tree';
import { DraggableItem } from '@/components/dnd/draggable-item';
import { DroppableFolder } from '@/components/dnd/droppable-folder';
import { useWorkspaceDnd } from '@/components/dnd/dnd-context';
import { SearchDropdown } from '@/components/search/search-dropdown';
import { ShareDialog } from '@/components/sharing/share-dialog';
import { VersionListDialog } from '@/components/versions/version-list-dialog';
import { RevisionSidebar } from '@/components/revisions/revision-sidebar';
import { BulkActionToolbar } from '@/components/bulk/bulk-action-toolbar';

export function ContentArea() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameNodeId, setRenameNodeId] = useState<string>('');
  const [renameNodeName, setRenameNodeName] = useState<string>('');
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareNode, setShareNode] = useState<TreeNode | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionNodeId, setVersionNodeId] = useState<string>('');
  const [versionFileName, setVersionFileName] = useState<string>('');
  const [showRevisionSidebar, setShowRevisionSidebar] = useState(false);

  const {
    tree,
    flatNodes,
    currentFolderId,
    currentFolderPath,
    setCurrentFolder,
    isLoading,
    selectedNodeIds,
    selectNode,
  } = useFileTreeStore();

  const { isDragging } = useWorkspaceDnd();

  const deleteMutation = useDeleteNode();

  // Get items in the current folder
  const currentFolder = flatNodes.get(currentFolderId || '');
  const itemsInFolder = currentFolder?.children || tree;

  // Search is now handled by SearchDropdown — items display is unfiltered locally
  const filteredItems = itemsInFolder;

  // Multi-select: get selected nodes for drag operations
  const getSelectedNodes = (draggedNode: TreeNode): TreeNode[] => {
    if (multiSelectedIds.size > 0 && multiSelectedIds.has(draggedNode.id)) {
      return Array.from(multiSelectedIds)
        .map(id => flatNodes.get(id))
        .filter(Boolean) as TreeNode[];
    }
    return [draggedNode];
  };

  // Handle multi-select click (Ctrl/Cmd + click)
  const handleItemClick = (node: TreeNode, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey)) {
      // Multi-select
      const newSelection = new Set(multiSelectedIds);
      if (newSelection.has(node.id)) {
        newSelection.delete(node.id);
      } else {
        newSelection.add(node.id);
      }
      setMultiSelectedIds(newSelection);
      return;
    }

    // Clear multi-selection on regular click
    setMultiSelectedIds(new Set());

    if (node.type === 'folder') {
      navigateToFolder(node.id, node.name);
    } else if (node.type === 'note') {
      openNote(node.id);
    } else {
      setSelectedNodeId(node.id);
    }
  };

  // Navigate to folder
  const navigateToFolder = (folderId: string, folderName: string) => {
    const newPath = [...currentFolderPath, { id: folderId, name: folderName }];
    setCurrentFolder(folderId, newPath);
    setSelectedNodeId(null);
  };

  // Navigate up
  const navigateUp = () => {
    if (currentFolderPath.length > 1) {
      const parentPath = currentFolderPath.slice(0, -1);
      const parentFolder = parentPath[parentPath.length - 1];
      setCurrentFolder(parentFolder.id, parentPath);
      setSelectedNodeId(null);
    }
  };

  // Navigate via breadcrumb
  const navigateBreadcrumb = (index: number) => {
    const newPath = currentFolderPath.slice(0, index + 1);
    const target = newPath[newPath.length - 1];
    setCurrentFolder(target.id, newPath);
    setSelectedNodeId(null);
  };

  // Open note editor
  const openNote = (noteId: string) => {
    setSelectedNodeId(noteId);
  };

  const handleRename = (nodeId: string, currentName: string) => {
    setRenameNodeId(nodeId);
    setRenameNodeName(currentName);
    setRenameDialogOpen(true);
  };

  const handleDelete = (nodeId: string) => {
    deleteMutation.mutate({ nodeId });
  };

  const handleShare = (node: TreeNode) => {
    setShareNode(node);
    setShareDialogOpen(true);
  };

  const handleVersionHistory = (node: TreeNode) => {
    setVersionNodeId(node.id);
    setVersionFileName(node.name);
    setVersionDialogOpen(true);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const getIcon = (type: NodeType) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-5 w-5 text-orange-500" />;
      case 'file':
        return <File className="h-5 w-5 text-muted-foreground" />;
      case 'note':
        return <FileText className="h-5 w-5 text-emerald-600" />;
    }
  };

  // If a note is selected, show the note editor + optional revision sidebar
  const selectedNode = selectedNodeId ? flatNodes.get(selectedNodeId) : null;
  if (selectedNode && selectedNode.type === 'note') {
    return (
      <div className="flex h-full">
        {/* Main content area */}
        <div className={showRevisionSidebar ? 'flex-1 flex flex-col p-6 transition-all min-w-0' : 'flex-1 flex flex-col p-6 transition-all'}>
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedNodeId(null);
                setShowRevisionSidebar(false);
              }}
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <h2 className="text-lg font-semibold">{selectedNode.name}</h2>
            <Separator orientation="vertical" className="h-4" />
            <Button
              variant={showRevisionSidebar ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowRevisionSidebar(!showRevisionSidebar)}
            >
              <History className="h-4 w-4 mr-1" />
              Version History
            </Button>
          </div>
          <NoteEditor nodeId={selectedNode.id} />
        </div>

        {/* Revision sidebar panel */}
        <AnimatePresence>
          {showRevisionSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 overflow-hidden"
            >
              <RevisionSidebar
                nodeId={selectedNode.id}
                onClose={() => setShowRevisionSidebar(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Breadcrumb */}
          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList>
              {currentFolderPath.map((segment, index) => (
                <Fragment key={`bc-${index}`}>
                  {index > 0 && (
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem>
                    {index === currentFolderPath.length - 1 ? (
                      <BreadcrumbPage className="text-sm truncate">
                        {segment.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        onClick={() => navigateBreadcrumb(index)}
                        className="text-sm cursor-pointer truncate"
                      >
                        {segment.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>



          {/* Search — 12.4: debounced dropdown */}
          <SearchDropdown
            className="hidden sm:block w-48"
            onNavigateToNode={(nodeId, nodeType, parentId) => {
              setMultiSelectedIds(new Set());
              if (nodeType === 'folder') {
                const folderNode = flatNodes.get(nodeId);
                if (folderNode) {
                  navigateToFolder(nodeId, folderNode.name);
                }
              } else if (nodeType === 'note') {
                // Navigate to parent folder then open note
                if (parentId) {
                  const parentFolder = flatNodes.get(parentId);
                  if (parentFolder) {
                    setCurrentFolder(parentId, []);
                  }
                }
                openNote(nodeId);
              } else {
                // File — navigate to parent folder
                if (parentId) {
                  const parentFolder = flatNodes.get(parentId);
                  if (parentFolder) {
                    setCurrentFolder(parentId, []);
                  }
                }
                setSelectedNodeId(nodeId);
              }
            }}
          />

          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar — 18.2: appears when multi-select is active */}
      {multiSelectedIds.size > 0 && (
        <BulkActionToolbar
          selectedIds={multiSelectedIds}
          onClearSelection={() => setMultiSelectedIds(new Set())}
        />
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Upload Zone */}
          <UploadZone />

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Folder className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">This folder is empty</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Drag files here or create a new folder/note
              </p>
            </motion.div>
          )}

          {/* Items */}
          {!isLoading && filteredItems.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredItems.map((node) => {
                      // Folder items get DroppableFolder wrapper + DraggableItem
                      // Non-folder items just get DraggableItem
                      const isSelected = multiSelectedIds.has(node.id);

                      const cardContent = (
                        <Card
                          className={`cursor-pointer hover:border-accent transition-colors group relative
                            ${isSelected ? 'ring-2 ring-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10' : ''}
                            ${isDragging ? 'pointer-events-none' : ''}
                          `}
                          onClick={(e) => handleItemClick(node, e)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                              {getIcon(node.type)}
                            </div>
                            <span className="text-sm font-medium truncate max-w-full">
                              {node.name}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {node.type === 'folder' && (
                                <span>{node.children?.length || 0} items</span>
                              )}
                              {node.type === 'file' && node.metadata && (
                                <span>{formatBytes(node.metadata.sizeBytes)}</span>
                              )}
                              {node.type === 'note' && (
                                <span>Note</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(node.updatedAt)}
                            </span>
                          </CardContent>

                          {/* Actions overlay */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRename(node.id, node.name)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShare(node)}>
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                {node.type === 'file' && (
                                  <DropdownMenuItem onClick={() => handleVersionHistory(node)}>
                                    <History className="h-4 w-4 mr-2" />
                                    Version History
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDelete(node.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      );

                      // Wrap folder cards with DroppableFolder for drop targets
                      if (node.type === 'folder') {
                        return (
                          <DraggableItem
                            key={node.id}
                            id={node.id}
                            node={node}
                            selectedNodes={getSelectedNodes(node)}
                          >
                            <DroppableFolder id={node.id} node={node}>
                              {cardContent}
                            </DroppableFolder>
                          </DraggableItem>
                        );
                      }

                      return (
                        <DraggableItem
                          key={node.id}
                          id={node.id}
                          node={node}
                          selectedNodes={getSelectedNodes(node)}
                        >
                          {cardContent}
                        </DraggableItem>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredItems.map((node) => {
                      const isSelected = multiSelectedIds.has(node.id);

                      const rowContent = (
                        <div
                          className={`flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 cursor-pointer group transition-colors
                            ${isSelected ? 'ring-2 ring-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10' : ''}
                            ${isDragging ? 'pointer-events-none' : ''}
                          `}
                          onClick={(e) => handleItemClick(node, e)}
                        >
                          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0">
                            {getIcon(node.type)}
                          </div>
                          <span className="text-sm font-medium truncate flex-1 min-w-0">
                            {node.name}
                          </span>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                            {node.type === 'folder' && (
                              <span>{node.children?.length || 0} items</span>
                            )}
                            {node.type === 'file' && node.metadata && (
                              <span>{formatBytes(node.metadata.sizeBytes)}</span>
                            )}
                            {node.type === 'note' && (
                              <span>Note</span>
                            )}
                            <span>{formatDate(node.updatedAt)}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRename(node.id, node.name)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleShare(node)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              {node.type === 'file' && (
                                <DropdownMenuItem onClick={() => handleVersionHistory(node)}>
                                  <History className="h-4 w-4 mr-2" />
                                  Version History
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(node.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );

                      // Wrap folder rows with DroppableFolder
                      if (node.type === 'folder') {
                        return (
                          <DraggableItem
                            key={node.id}
                            id={node.id}
                            node={node}
                            selectedNodes={getSelectedNodes(node)}
                          >
                            <DroppableFolder id={node.id} node={node}>
                              {rowContent}
                            </DroppableFolder>
                          </DraggableItem>
                        );
                      }

                      return (
                        <DraggableItem
                          key={node.id}
                          id={node.id}
                          node={node}
                          selectedNodes={getSelectedNodes(node)}
                        >
                          {rowContent}
                        </DraggableItem>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        nodeId={renameNodeId}
        currentName={renameNodeName}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        node={shareNode}
      />

      {/* Version History Dialog */}
      <VersionListDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        nodeId={versionNodeId}
        fileName={versionFileName}
      />
    </div>
  );
}
