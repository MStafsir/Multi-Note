'use client';

// ============================================================
// MODUL 15.4: File Version History — Timeline Dialog
// Shows version list with actions: restore, download, diff preview
// 15.6 — Storage cost visibility (total size of all versions)
// ============================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Download,
  RotateCcw,
  Eye,
  Loader2,
  AlertTriangle,
  Clock,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FileVersionListData, FileVersionInfo } from '@/types';
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
import { VersionDiffDialog } from './version-diff-dialog';

interface VersionListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  fileName: string;
}

const MAX_VERSIONS = 20;

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function isTextFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const textExtensions = ['txt', 'md', 'json', 'csv', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'log', 'py', 'rb', 'sh', 'bat'];
  return textExtensions.includes(ext);
}

export function VersionListDialog({
  open,
  onOpenChange,
  nodeId,
  fileName,
}: VersionListDialogProps) {
  const queryClient = useQueryClient();
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number>(0);

  // Fetch version list
  const { data: versionData, isLoading } = useQuery<FileVersionListData>({
    queryKey: ['file-versions', nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}/versions`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: open,
    staleTime: 30000,
  });

  // Find current (latest) version ID for diff
  const currentVersionId = versionData?.versions?.[0]?.id || '';

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/nodes/${nodeId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-versions', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Version restored successfully');
    },
    onError: (error) => {
      toast.error(`Restore failed: ${error.message}`);
    },
  });

  // Download handler
  const handleDownload = async (version: FileVersionInfo) => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/versions/${version.id}`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-v${version.versionNumber}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloading version ${version.versionNumber}`);
    } catch (error) {
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Diff preview handler
  const handleDiffPreview = (version: FileVersionInfo) => {
    setSelectedVersionId(version.id);
    setSelectedVersionNumber(version.versionNumber);
    setDiffDialogOpen(true);
  };

  // Restore handler
  const handleRestore = (version: FileVersionInfo) => {
    restoreMutation.mutate(version.id);
  };

  const versions = versionData?.versions || [];
  const totalSizeBytes = versionData?.totalSizeBytes || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Version History — {fileName}
            </DialogTitle>
            <DialogDescription>
              View, compare, and restore previous versions of this file.
            </DialogDescription>
          </DialogHeader>

          {/* Storage cost visibility (15.6) */}
          {totalSizeBytes > 0 && (
            <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground bg-muted/50 rounded-md py-2 px-3">
              <HardDrive className="h-4 w-4 shrink-0" />
              <span>
                Version history uses <strong className="text-foreground">{formatBytes(totalSizeBytes)}</strong> of your storage
              </span>
              {versions.length >= MAX_VERSIONS && (
                <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Max {MAX_VERSIONS} — oldest will be pruned
                </Badge>
              )}
            </div>
          )}

          {/* Version timeline */}
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading versions...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No version history available</p>
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {versions.map((version, index) => {
                  const isCurrent = index === 0;
                  const canDiff = isTextFile(fileName) && !isCurrent;

                  return (
                    <motion.div
                      key={version.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.03 }}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors
                        ${isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-800' : 'hover:bg-accent/50'}
                      `}
                    >
                      {/* Version number + timeline dot */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <div className={`w-3 h-3 rounded-full border-2
                          ${isCurrent ? 'bg-emerald-500 border-emerald-500' : 'bg-muted border-muted-foreground/30'}
                        `} />
                        {index < versions.length - 1 && (
                          <div className="w-0.5 h-6 bg-border" />
                        )}
                      </div>

                      {/* Version info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            v{version.versionNumber}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                              Current
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(version.sizeBytes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}</span>
                          <span className="opacity-50">·</span>
                          <span>{format(new Date(version.createdAt), 'PPp')}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canDiff && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleDiffPreview(version)}
                            aria-label={`View diff for v${version.versionNumber}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Diff
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleDownload(version)}
                          aria-label={`Download v${version.versionNumber}`}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                        {!isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                            onClick={() => handleRestore(version)}
                            disabled={restoreMutation.isPending}
                            aria-label={`Restore v${version.versionNumber}`}
                          >
                            {restoreMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            )}
                            Restore
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff Dialog — opened from version list */}
      <VersionDiffDialog
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        nodeId={nodeId}
        currentVersionId={currentVersionId}
        selectedVersionId={selectedVersionId}
        selectedVersionNumber={selectedVersionNumber}
        fileName={fileName}
      />
    </>
  );
}
