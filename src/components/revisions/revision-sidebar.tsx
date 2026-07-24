'use client';

// ============================================================
// MODUL 16.4: Note Revision Sidebar — Google Docs style timeline
// Shows revision list, hover preview, diff comparison, restore
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  RotateCcw,
  Eye,
  Loader2,
  History,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { NoteRevisionListData, NoteRevisionInfo, RevisionTriggerType, DiffData } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RevisionDiffView } from './revision-diff-view';

interface RevisionSidebarProps {
  nodeId: string;
  onClose: () => void;
}

// Trigger type badge colors
function triggerBadgeVariant(triggerType: RevisionTriggerType) {
  switch (triggerType) {
    case 'autosave':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'manual':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'restore':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    default:
      return '';
  }
}

function triggerBadgeLabel(triggerType: RevisionTriggerType) {
  switch (triggerType) {
    case 'autosave': return 'Auto';
    case 'manual': return 'Manual';
    case 'restore': return 'Restore';
    default: return triggerType;
  }
}

export function RevisionSidebar({ nodeId, onClose }: RevisionSidebarProps) {
  const queryClient = useQueryClient();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [hoverTimeoutId, setHoverTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Fetch revision list
  const { data: revisionData, isLoading } = useQuery<NoteRevisionListData>({
    queryKey: ['note-revisions', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}/revisions`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 30000,
  });

  // Fetch current note data for diff comparison
  const { data: currentNoteData } = useQuery({
    queryKey: ['note', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 30000,
  });

  // Fetch revision content on hover (preview)
  const fetchPreview = useCallback(async (revisionId: string) => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/revisions/${revisionId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Parse contentJson to show text preview
      const contentJson = json.data?.contentJsonSnapshot;
      if (contentJson) {
        try {
          const parsed = JSON.parse(contentJson);
          const textLines: string[] = [];
          function extractText(node: Record<string, unknown>) {
            if (node.type === 'text' && node.text) {
              textLines.push(String(node.text));
              return;
            }
            if (node.content && Array.isArray(node.content)) {
              for (const child of node.content) {
                extractText(child as Record<string, unknown>);
              }
              if (node.type === 'paragraph' || node.type === 'heading') {
                textLines.push('');
              }
            }
            if (node.marks && Array.isArray(node.marks) && node.text) {
              textLines.push(String(node.text));
            }
          }
          if (parsed && parsed.content) {
            for (const topNode of parsed.content) {
              extractText(topNode as Record<string, unknown>);
            }
          }
          setPreviewContent(textLines.join('\n').trim() || 'Empty note');
        } catch {
          setPreviewContent(contentJson || 'Unable to parse content');
        }
      } else {
        setPreviewContent('Empty revision');
      }
    } catch {
      setPreviewContent('Failed to load preview');
    }
  }, [nodeId]);

  // Handle hover on revision — fetch preview after 300ms delay
  const handleRevisionHover = useCallback((revisionId: string) => {
    // Clear existing timeout
    if (hoverTimeoutId) {
      clearTimeout(hoverTimeoutId);
    }

    const timeout = setTimeout(() => {
      fetchPreview(revisionId);
    }, 300);
    setHoverTimeoutId(timeout);
  }, [hoverTimeoutId, fetchPreview]);

  // Handle hover end
  const handleRevisionHoverEnd = useCallback(() => {
    if (hoverTimeoutId) {
      clearTimeout(hoverTimeoutId);
      setHoverTimeoutId(null);
    }
  }, [hoverTimeoutId]);

  // Handle click revision — show diff with current
  const handleRevisionClick = useCallback(async (revision: NoteRevisionInfo) => {
    setSelectedRevisionId(revision.id);
    setShowDiff(true);
    setPreviewContent(null);

    // We need to get current revision content for diff comparison
    // The diff API requires compareWith param — use current note content
    try {
      // Get the current revision for comparison
      // First, find or create a "current" revision ID from the latest revision
      const currentRevisionId = revisionData?.revisions?.[0]?.id;
      if (!currentRevisionId) {
        toast.error('Cannot compare — no current revision found');
        return;
      }

      // Fetch diff between selected revision and current (latest) revision
      const res = await fetch(`/api/nodes/${nodeId}/revisions/${revision.id}/diff?compareWith=${currentRevisionId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setDiffData({ diff: json.data.diff || [] });
    } catch (error) {
      toast.error(`Failed to load diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowDiff(false);
    }
  }, [nodeId, revisionData]);

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      const res = await fetch(`/api/nodes/${nodeId}/revisions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-revisions', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['note', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Revision restored successfully');
      setShowDiff(false);
      setSelectedRevisionId(null);
    },
    onError: (error) => {
      toast.error(`Restore failed: ${error.message}`);
    },
  });

  // Close diff view
  const handleCloseDiff = () => {
    setShowDiff(false);
    setSelectedRevisionId(null);
    setDiffData(null);
  };

  const revisions = revisionData?.revisions || [];

  // Cleanup hover timeout on unmount
  const cleanupRef = useRef(hoverTimeoutId);
  cleanupRef.current = hoverTimeoutId;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full border-l bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Version History</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close version history">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content area — either diff view or revision list */}
      <ScrollArea className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {showDiff && selectedRevisionId && diffData ? (
            /* Diff view mode */
            <motion.div
              key="diff-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {/* Selected revision info */}
              {(() => {
                const selectedRevision = revisions.find(r => r.id === selectedRevisionId);
                const currentRevision = revisions[0];
                if (!selectedRevision || !currentRevision) return null;
                return (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">
                        r{selectedRevision.revisionNumber} → r{currentRevision.revisionNumber}
                      </span>
                      <Badge variant="outline" className={triggerBadgeVariant(selectedRevision.triggerType)}>
                        {triggerBadgeLabel(selectedRevision.triggerType)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(selectedRevision.createdAt), 'PPp')} → current
                    </div>
                  </div>
                );
              })()}

              {/* Diff rendering */}
              <RevisionDiffView diffData={diffData} />

              <Separator className="my-4" />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCloseDiff}>
                  Back to list
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      disabled={restoreMutation.isPending}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Restore this revision
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Revision Restore</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will restore the selected revision as your current note content.
                        Your current content will be preserved as a new revision (non-destructive restore).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => restoreMutation.mutate(selectedRevisionId)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        Confirm Restore
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ) : (
            /* Revision list mode */
            <motion.div
              key="revision-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading revisions...</span>
                </div>
              ) : revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No revision history available</p>
                  <p className="text-xs mt-1">Revisions are created automatically as you edit</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {revisions.map((revision, index) => {
                    const isCurrent = index === 0;
                    const isSelected = selectedRevisionId === revision.id;

                    return (
                      <motion.div
                        key={revision.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: index * 0.03 }}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors
                          ${isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-800' : ''}
                          ${isSelected ? 'bg-accent ring-1 ring-accent' : ''}
                          ${!isCurrent && !isSelected ? 'hover:bg-accent/50' : ''}
                        `}
                        onClick={() => handleRevisionClick(revision)}
                        onMouseEnter={() => handleRevisionHover(revision.id)}
                        onMouseLeave={handleRevisionHoverEnd}
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                          <div className={`w-3 h-3 rounded-full border-2
                            ${isCurrent ? 'bg-emerald-500 border-emerald-500' : 'bg-muted border-muted-foreground/30'}
                          `} />
                          {index < revisions.length - 1 && (
                            <div className="w-0.5 h-4 bg-border" />
                          )}
                        </div>

                        {/* Revision info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">r{revision.revisionNumber}</span>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                Current
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs ${triggerBadgeVariant(revision.triggerType)}`}>
                              {triggerBadgeLabel(revision.triggerType)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(revision.createdAt), { addSuffix: true })}</span>
                            <span className="opacity-50">·</span>
                            <span>{format(new Date(revision.createdAt), 'PPp')}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isCurrent && (
                          <div className="flex items-center gap-1 shrink-0">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                                  disabled={restoreMutation.isPending}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Restore Revision r{revision.revisionNumber}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will restore revision {revision.revisionNumber} as your current note content.
                                    Your current content will be saved as a new revision first (non-destructive).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => restoreMutation.mutate(revision.id)}
                                    className="bg-orange-600 hover:bg-orange-700"
                                  >
                                    Confirm Restore
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Hover preview panel */}
              <AnimatePresence>
                {previewContent && !showDiff && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    ref={previewRef}
                    className="mt-3 p-3 rounded-lg bg-muted/50 border text-sm"
                  >
                    <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span>Preview</span>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap line-clamp-8 max-h-32 overflow-y-auto">
                      {previewContent}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Footer hint */}
      <div className="p-3 border-t text-xs text-muted-foreground">
        <AlertTriangle className="h-3 w-3 mr-1 inline" />
        Click a revision to compare with current. Restore is non-destructive.
      </div>
    </motion.div>
  );
}
