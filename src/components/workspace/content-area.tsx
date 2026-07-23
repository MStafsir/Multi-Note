'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  File,
  FileText,
  ChevronRight,
  Grid3X3,
  List,
  Search,
  ArrowUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { TreeNode, NodeType } from '@/types';
import { useFileTreeStore } from '@/store/file-tree';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export function ContentArea() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameNodeId, setRenameNodeId] = useState<string>('');
  const [renameNodeName, setRenameNodeName] = useState<string>('');

  const {
    tree,
    flatNodes,
    currentFolderId,
    currentFolderPath,
    setCurrentFolder,
    isLoading,
  } = useFileTreeStore();

  const deleteMutation = useDeleteNode();

  // Get items in the current folder
  const currentFolder = flatNodes.get(currentFolderId || '');
  const itemsInFolder = currentFolder?.children || tree;

  // Filter items by search
  const filteredItems = searchQuery
    ? itemsInFolder.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : itemsInFolder;

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

  // Handle item click
  const handleItemClick = (node: TreeNode) => {
    if (node.type === 'folder') {
      navigateToFolder(node.id, node.name);
    } else if (node.type === 'note') {
      openNote(node.id);
    } else {
      // For files, we could show download preview, but for now just select
      setSelectedNodeId(node.id);
    }
  };

  const handleRename = (nodeId: string, currentName: string) => {
    setRenameNodeId(nodeId);
    setRenameNodeName(currentName);
    setRenameDialogOpen(true);
  };

  const handleDelete = (nodeId: string) => {
    deleteMutation.mutate({ nodeId });
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

  // If a note is selected, show the note editor
  const selectedNode = selectedNodeId ? flatNodes.get(selectedNodeId) : null;
  if (selectedNode && selectedNode.type === 'note') {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedNodeId(null)}
          >
            <ArrowUp className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <h2 className="text-lg font-semibold">{selectedNode.name}</h2>
        </div>
        <NoteEditor nodeId={selectedNode.id} />
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

          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-9"
            />
          </div>

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
          {!isLoading && filteredItems.length === 0 && !searchQuery && (
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
                    {filteredItems.map((node) => (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        whileHover={{ y: -2 }}
                      >
                        <Card
                          className="cursor-pointer hover:border-accent transition-colors group relative"
                          onClick={() => handleItemClick(node)}
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
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredItems.map((node) => (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div
                          className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 cursor-pointer group transition-colors"
                          onClick={() => handleItemClick(node)}
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
                      </motion.div>
                    ))}
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
    </div>
  );
}
