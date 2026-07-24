'use client';

// ============================================================
// MODUL 15.5: File Version Diff Dialog
// Shows line-by-line diff between a selected version and current
// Color coding: green (add), red (remove), neutral (same)
// Only works for text files — shows "Diff not available" for binary
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GitCompare,
  RotateCcw,
  Loader2,
  FileX,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DiffLine } from '@/types';
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

interface VersionDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  currentVersionId: string;
  selectedVersionId: string;
  selectedVersionNumber: number;
  fileName: string;
}

function isTextFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const textExtensions = ['txt', 'md', 'json', 'csv', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'log', 'py', 'rb', 'sh', 'bat'];
  return textExtensions.includes(ext);
}

export function VersionDiffDialog({
  open,
  onOpenChange,
  nodeId,
  currentVersionId,
  selectedVersionId,
  selectedVersionNumber,
  fileName,
}: VersionDiffDialogProps) {
  const queryClient = useQueryClient();

  // Check if file supports diff
  const isText = isTextFile(fileName);

  // Fetch diff data
  const { data: diffData, isLoading, error } = useQuery<{
    versionId: string;
    versionNumber: number;
    lines: DiffLine[];
  }>({
    queryKey: ['file-version-diff', nodeId, selectedVersionId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}/versions/${selectedVersionId}/diff`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: open && isText && selectedVersionId !== currentVersionId,
    staleTime: 60000,
  });

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
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Restore failed: ${error.message}`);
    },
  });

  // Count diff stats
  const lines = diffData?.lines || [];
  const addedCount = lines.filter(l => l.type === 'add').length;
  const removedCount = lines.filter(l => l.type === 'remove').length;
  const sameCount = lines.filter(l => l.type === 'same').length;

  // Line number tracking
  let oldLineNum = 0;
  let newLineNum = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-muted-foreground" />
            Diff Preview — v{selectedVersionNumber} → Current
          </DialogTitle>
          <DialogDescription>
            Comparing version {selectedVersionNumber} with the current version of {fileName}.
          </DialogDescription>
        </DialogHeader>

        {/* Not a text file */}
        {!isText && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileX className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-base font-medium">Diff not available</p>
            <p className="text-sm mt-1">
              This file type ({fileName.split('.').pop()}) does not support text diff preview.
            </p>
          </div>
        )}

        {/* Same version selected */}
        {isText && selectedVersionId === currentVersionId && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-base font-medium">This is the current version</p>
            <p className="text-sm mt-1">No differences to show.</p>
          </div>
        )}

        {/* Loading */}
        {isText && selectedVersionId !== currentVersionId && isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading diff...</span>
          </div>
        )}

        {/* Error */}
        {isText && selectedVersionId !== currentVersionId && error && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-10 w-10 mb-3" />
            <p className="text-base font-medium">Failed to load diff</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Diff content */}
        {isText && selectedVersionId !== currentVersionId && !isLoading && !error && diffData && (
          <>
            {/* Stats */}
            <div className="flex items-center gap-2 pb-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                +{addedCount} added
              </Badge>
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800">
                -{removedCount} removed
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {sameCount} unchanged
              </Badge>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="font-mono text-sm space-y-0 pb-4">
                {lines.map((line, index) => {
                  // Track line numbers
                  if (line.type === 'same' || line.type === 'remove') oldLineNum++;
                  if (line.type === 'same' || line.type === 'add') newLineNum++;

                  const currentOld = line.type === 'remove' || line.type === 'same' ? oldLineNum : null;
                  const currentNew = line.type === 'add' || line.type === 'same' ? newLineNum : null;

                  return (
                    <motion.div
                      key={`diff-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.1, delay: Math.min(index * 0.01, 0.5) }}
                      className={`flex items-start gap-3 py-0.5 px-2 rounded-sm
                        ${line.type === 'add' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-l-2 border-emerald-400' : ''}
                        ${line.type === 'remove' ? 'bg-red-50 dark:bg-red-950/20 border-l-2 border-red-400' : ''}
                        ${line.type === 'same' ? 'bg-transparent' : ''}
                      `}
                    >
                      {/* Line numbers */}
                      <div className="flex gap-1 text-xs text-muted-foreground shrink-0 w-16 select-none">
                        <span className="w-6 text-right">{currentOld || ''}</span>
                        <span className="w-6 text-right">{currentNew || ''}</span>
                      </div>

                      {/* Type indicator */}
                      <span className={`text-xs font-bold shrink-0 w-4 select-none
                        ${line.type === 'add' ? 'text-emerald-600' : ''}
                        ${line.type === 'remove' ? 'text-red-600' : ''}
                        ${line.type === 'same' ? 'text-muted-foreground' : ''}
                      `}>
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>

                      {/* Content */}
                      <span className={`flex-1 min-w-0 whitespace-pre-wrap break-all
                        ${line.type === 'add' ? 'text-emerald-700 dark:text-emerald-300' : ''}
                        ${line.type === 'remove' ? 'text-red-700 dark:text-red-300' : ''}
                        ${line.type === 'same' ? 'text-foreground' : ''}
                      `}>
                        {line.content || ' '}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            <Separator />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => restoreMutation.mutate(selectedVersionId)}
                disabled={restoreMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {restoreMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Confirm Restore v{selectedVersionNumber}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
