'use client';

// ============================================================
// MODUL 17: Trash View — Full trash page component
// Shows list of trashed nodes with restore/empty options
// Replaces workspace content area when viewing trash
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Trash2,
  RotateCcw,
  Folder,
  File,
  FileText,
  Loader2,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useTrashList, useTrashRestore, type TrashedNode } from '@/hooks/use-trash';
import { EmptyTrashDialog } from './empty-trash-dialog';
import { useFileTreeStore } from '@/store/file-tree';
import type { NodeType } from '@/types';

export function TrashView() {
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { setActiveView } = useFileTreeStore();

  const { data: trashedNodes = [], isLoading, error } = useTrashList();
  const restoreMutation = useTrashRestore();

  const handleRestore = (nodeId: string) => {
    setRestoringId(nodeId);
    restoreMutation.mutate(
      { nodeId },
      {
        onSettled: () => setRestoringId(null),
      }
    );
  };

  const handleBackToWorkspace = () => {
    setActiveView('workspace');
  };

  const formatBytes = (bytes: number | null): string => {
    if (!bytes || bytes <= 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
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

  const getTypeBadgeVariant = (type: NodeType) => {
    switch (type) {
      case 'folder':
        return 'secondary' as const;
      case 'file':
        return 'outline' as const;
      case 'note':
        return 'secondary' as const;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToWorkspace}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Trash</h2>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading trash...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToWorkspace}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Trash</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <p className="text-sm text-destructive">Failed to load trash items</p>
          <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackToWorkspace}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Trash</h2>

          {trashedNodes.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {trashedNodes.length} items
            </Badge>
          )}

          <div className="flex-1" />

          {trashedNodes.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptyTrashOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Empty Trash
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Empty state */}
          {trashedNodes.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Trash2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Trash is empty</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Items you delete will appear here for 30 days before being permanently removed
              </p>
            </motion.div>
          )}

          {/* Items list */}
          {trashedNodes.length > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1"
              >
                {trashedNodes.map((node) => {
                  const isRestoring = restoringId === node.id;
                  const parentLabel = node.parentId ? 'In a folder' : 'Root';

                  return (
                    <motion.div
                      key={node.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 group transition-colors"
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {getIcon(node.type)}
                      </div>

                      {/* Name + info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {node.name}
                          </span>
                          <Badge variant={getTypeBadgeVariant(node.type)} className="text-xs shrink-0">
                            {node.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{parentLabel}</span>
                          <span>·</span>
                          <span>Deleted {formatDate(node.deletedAt)}</span>
                          {node.type === 'file' && node.metadata?.sizeBytes && (
                            <>
                              <span>·</span>
                              <span>{formatBytes(node.metadata.sizeBytes)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Restore button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRestore(node.id)}
                        disabled={isRestoring || restoreMutation.isPending}
                      >
                        {isRestoring ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-1" />
                        )}
                        Restore
                      </Button>

                      {/* More options */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRestore(node.id)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Empty Trash Dialog */}
      <EmptyTrashDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        itemCount={trashedNodes.length}
      />
    </div>
  );
}
