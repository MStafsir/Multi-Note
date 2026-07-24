'use client';

// ============================================================
// MODUL 18.2: Bulk Action Toolbar — Contextual toolbar
// Appears when selectedNodeIds.size > 0 (multi-select active)
// Actions: Move, Delete, Download ZIP, Share, Tag
// "Clear selection" button
// For > 20 items, shows progress indicator (18.5)
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  FolderInput,
  Download,
  Share2,
  Tag,
  X,
  Loader2,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBulkDelete, useBulkMove, useBulkDownload, useBulkShare, useBulkTag } from '@/hooks/use-bulk-operations';
import { useFileTreeStore } from '@/store/file-tree';
import { BulkMoveDialog } from './bulk-move-dialog';
import { BulkProgressBar } from './bulk-progress-bar';
import { BulkResultSummary, type BulkResultItem } from './bulk-result-summary';
import { toast } from 'sonner';
import type { TreeNode } from '@/types';

interface BulkActionToolbarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActionToolbar({ selectedIds, onClearSelection }: BulkActionToolbarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [showResultSummary, setShowResultSummary] = useState(false);
  const [resultItems, setResultItems] = useState<BulkResultItem[]>([]);
  const [resultTotalCount, setResultTotalCount] = useState(0);

  // Share dialog state
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<string>('view');
  const [shareLookupLoading, setShareLookupLoading] = useState(false);

  // Tag dialog state
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6B7280');

  const { flatNodes } = useFileTreeStore();

  const bulkDelete = useBulkDelete();
  const bulkMove = useBulkMove();
  const bulkDownload = useBulkDownload();
  const bulkShare = useBulkShare();
  const bulkTag = useBulkTag();

  const nodeIds = Array.from(selectedIds);
  const selectedNodes = nodeIds
    .map(id => flatNodes.get(id))
    .filter(Boolean) as TreeNode[];
  const count = selectedIds.size;

  // Determine if we need progress indication (> 20 items)
  const needsProgress = count > 20;

  // Handle bulk delete
  const handleBulkDelete = () => {
    bulkDelete.mutate(
      { nodeIds },
      {
        onSuccess: (result) => {
          setDeleteDialogOpen(false);
          onClearSelection();
          // Build result items for summary
          const items: BulkResultItem[] = nodeIds.map(id => ({
            id,
            name: flatNodes.get(id)?.name || id,
            status: 'success' as const,
          }));
          setResultItems(items);
          setResultTotalCount(nodeIds.length);
          if (needsProgress) setShowResultSummary(true);
        },
        onError: (error) => {
          setDeleteDialogOpen(false);
          const items: BulkResultItem[] = nodeIds.map(id => ({
            id,
            name: flatNodes.get(id)?.name || id,
            status: 'failed' as const,
            reason: error.message,
          }));
          setResultItems(items);
          setResultTotalCount(nodeIds.length);
          setShowResultSummary(true);
        },
      }
    );
  };

  // Handle bulk move
  const handleBulkMove = (targetFolderId: string | null, targetFolderName: string) => {
    bulkMove.mutate(
      { nodeIds, targetFolderId },
      {
        onSuccess: () => {
          setMoveDialogOpen(false);
          onClearSelection();
        },
      }
    );
  };

  // Handle bulk download
  const handleBulkDownload = () => {
    setDownloadInProgress(true);
    bulkDownload.mutate(
      { nodeIds },
      {
        onSuccess: () => {
          setDownloadInProgress(false);
        },
        onError: () => {
          setDownloadInProgress(false);
        },
      }
    );
  };

  // Handle bulk share — lookup user by email first, then call bulk-share
  const handleBulkShare = async () => {
    if (!shareEmail.trim()) return;
    setShareLookupLoading(true);

    try {
      const lookupRes = await fetch(`/api/users/lookup?email=${encodeURIComponent(shareEmail.trim())}`);
      const lookupData = await lookupRes.json();

      if (!lookupData.success) {
        toast.error(lookupData.error || 'User not found');
        setShareLookupLoading(false);
        return;
      }

      const userId = lookupData.data.id;

      bulkShare.mutate(
        { nodeIds, sharedWithUserId: userId, permissionLevel: sharePermission },
        {
          onSuccess: (result) => {
            setShareDialogOpen(false);
            setShareEmail('');
            // Build result summary for partial failures
            const items: BulkResultItem[] = nodeIds.map((id, i) => ({
              id,
              name: flatNodes.get(id)?.name || id,
              status: i < result.sharedCount ? ('success' as const) : ('failed' as const),
              reason: i >= result.sharedCount ? 'Already shared or failed' : undefined,
            }));
            if (result.failedCount > 0) {
              setResultItems(items);
              setResultTotalCount(nodeIds.length);
              setShowResultSummary(true);
            }
            onClearSelection();
          },
          onError: () => {
            setShareLookupLoading(false);
          },
        }
      );
    } catch {
      toast.error('Failed to find user');
      setShareLookupLoading(false);
    }
  };

  // Handle bulk tag — we need to find or create the tag first
  // For simplicity, we assume the tag already exists and we find it by name
  // In a production app, this would have a proper tag picker
  const handleBulkTag = async () => {
    if (!tagName.trim()) return;

    // Try to find the tag by name (via the nodes API which includes tags)
    // Since there's no dedicated tag list API, we create a simplified approach
    // that uses a known tagId. For the UI demo, we'll show a toast with what would happen.
    toast.info(`Tag "${tagName}" would be applied to ${count} items. Tag management UI is pending (Modul 21).`);
    setTagDialogOpen(false);
    onClearSelection();
  };

  // Check if any mutation is in progress
  const isMutating = bulkDelete.isPending || bulkMove.isPending || bulkDownload.isPending || bulkShare.isPending;

  if (count === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="sticky top-0 z-20 bg-emerald-50/90 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800 backdrop-blur px-4 py-2.5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Selection badge */}
            <div className="flex items-center gap-2 shrink-0">
              <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-medium">
                {count} items selected
              </Badge>
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                onClick={() => setMoveDialogOpen(true)}
                disabled={isMutating}
              >
                <FolderInput className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Move</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm border-emerald-200 dark:border-emerald-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isMutating}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                onClick={handleBulkDownload}
                disabled={isMutating || downloadInProgress}
              >
                {downloadInProgress ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Download ZIP</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                onClick={() => setShareDialogOpen(true)}
                disabled={isMutating}
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                onClick={() => setTagDialogOpen(true)}
                disabled={isMutating}
              >
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tag</span>
              </Button>
            </div>

            {/* Progress indicator for > 20 items */}
            {needsProgress && isMutating && (
              <BulkProgressBar
                current={0}
                total={count}
                operationName="Processing"
              />
            )}

            <div className="flex-1" />

            {/* Clear selection */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={onClearSelection}
              disabled={isMutating}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete {count} items?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move {count} selected items to the trash. Items in folders will also be trashed.
              <div className="mt-3 p-2 bg-muted rounded-md">
                <ScrollArea className="max-h-32">
                  <ul className="text-sm space-y-1">
                    {selectedNodes.slice(0, 10).map(node => (
                      <li key={node.id} className="flex items-center gap-1">
                        <span className="text-muted-foreground">&#x2022;</span>
                        <span className="truncate">{node.name}</span>
                      </li>
                    ))}
                    {selectedNodes.length > 10 && (
                      <li className="text-muted-foreground text-xs">
                        ... and {selectedNodes.length - 10} more items
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {bulkDelete.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Delete {count} items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Dialog */}
      <BulkMoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        nodeIds={nodeIds}
        selectedNodes={selectedNodes}
        onConfirm={handleBulkMove}
        isPending={bulkMove.isPending}
      />

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share {count} items
            </DialogTitle>
            <DialogDescription>
              Share all selected items with another user. They will receive a notification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Selected items preview */}
            <div className="p-2 bg-muted rounded-md">
              <ScrollArea className="max-h-24">
                <div className="flex flex-wrap gap-1">
                  {selectedNodes.slice(0, 8).map(node => (
                    <Badge key={node.id} variant="outline" className="text-xs truncate max-w-[120px]">
                      {node.name}
                    </Badge>
                  ))}
                  {selectedNodes.length > 8 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{selectedNodes.length - 8} more
                    </Badge>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Email input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Share with user by email</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter email address"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="flex-1"
                  type="email"
                />
                <Select value={sharePermission} onValueChange={setSharePermission}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="comment">Comment</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShareDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkShare}
              disabled={!shareEmail.trim() || shareLookupLoading || bulkShare.isPending}
            >
              {(shareLookupLoading || bulkShare.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Share2 className="h-4 w-4 mr-1" />
              )}
              Share {count} items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tag {count} items
            </DialogTitle>
            <DialogDescription>
              Apply a tag to all selected items. Items already tagged will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Selected items preview */}
            <div className="p-2 bg-muted rounded-md">
              <ScrollArea className="max-h-24">
                <div className="flex flex-wrap gap-1">
                  {selectedNodes.slice(0, 8).map(node => (
                    <Badge key={node.id} variant="outline" className="text-xs truncate max-w-[120px]">
                      {node.name}
                    </Badge>
                  ))}
                  {selectedNodes.length > 8 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{selectedNodes.length - 8} more
                    </Badge>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Tag name input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tag name</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter tag name"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="flex-1"
                />
                <div
                  className="w-8 h-8 rounded-md border shrink-0"
                  style={{ backgroundColor: tagColor }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tag management features will be available in Modul 21 (Favorites & Tags)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTagDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkTag}
              disabled={!tagName.trim()}
            >
              <Tag className="h-4 w-4 mr-1" />
              Apply tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Summary (for partial failures or > 20 items) */}
      {showResultSummary && (
        <BulkResultSummary
          items={resultItems}
          totalCount={resultTotalCount}
          onDismiss={() => setShowResultSummary(false)}
        />
      )}
    </>
  );
}
