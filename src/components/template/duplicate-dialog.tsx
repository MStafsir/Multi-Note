// ============================================================
// MODUL 33.3+33.5: Duplicate Dialog — Duplicate note with options
// Toggle options:
//   - "Copy database data" vs "Copy schema only" (33.5)
//   - "Keep embedded file references" vs "Strip them" (33.4)
// ============================================================

'use client';

import { useState } from 'react';
import { Copy, Loader2, Database, FileIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useDuplicateNote } from '@/hooks/use-templates';

interface DuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeName: string;
  hasDatabaseBlocks?: boolean;
  hasEmbeddedFiles?: boolean;
  onDuplicated?: (newNodeId: string) => void;
}

export function DuplicateDialog({
  open,
  onOpenChange,
  nodeId,
  nodeName,
  hasDatabaseBlocks,
  hasEmbeddedFiles,
  onDuplicated,
}: DuplicateDialogProps) {
  const [copyDatabaseData, setCopyDatabaseData] = useState(false);
  const [stripEmbeddedFiles, setStripEmbeddedFiles] = useState(false);

  const duplicateMutation = useDuplicateNote();

  const handleDuplicate = () => {
    duplicateMutation.mutate(
      {
        nodeId,
        copyDatabaseData,
        stripEmbeddedFiles,
      },
      {
        onSuccess: (data) => {
          onDuplicated?.(data.id);
          onOpenChange(false);
          // Reset toggles
          setCopyDatabaseData(false);
          setStripEmbeddedFiles(false);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCopyDatabaseData(false);
      setStripEmbeddedFiles(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-emerald-600" />
            Duplicate Note
          </DialogTitle>
          <DialogDescription>
            Create an independent copy of &quot;{nodeName}&quot;. Changes to the original won&apos;t affect the copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Database block toggle — 33.5 */}
          {hasDatabaseBlocks && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Copy database data</Label>
                    <p className="text-xs text-muted-foreground">
                      When ON: copies schema + all rows. When OFF: copies schema only (0 rows).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={copyDatabaseData}
                  onCheckedChange={setCopyDatabaseData}
                  aria-label="Toggle: copy database data or schema only"
                />
              </div>
              {!copyDatabaseData && (
                <div className="flex items-center gap-2 pl-8">
                  <Badge variant="secondary" className="text-xs h-5">
                    Schema only — no data copied
                  </Badge>
                </div>
              )}
              {copyDatabaseData && (
                <div className="flex items-center gap-2 pl-8">
                  <Badge variant="default" className="text-xs h-5 bg-orange-500 text-white">
                    Schema + data — full copy
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Embedded file toggle — 33.4 */}
          {hasEmbeddedFiles && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Strip embedded file references</Label>
                    <p className="text-xs text-muted-foreground">
                      When ON: replaces embedded files with placeholder text. When OFF: keeps references to original files.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={stripEmbeddedFiles}
                  onCheckedChange={setStripEmbeddedFiles}
                  aria-label="Toggle: strip embedded file references"
                />
              </div>
              {!stripEmbeddedFiles && (
                <div className="flex items-center gap-2 pl-8">
                  <Badge variant="secondary" className="text-xs h-5">
                    Keep file references — pointing to originals
                  </Badge>
                </div>
              )}
              {stripEmbeddedFiles && (
                <div className="flex items-center gap-2 pl-8">
                  <Badge variant="outline" className="text-xs h-5 text-destructive">
                    Strip files — replaced with placeholder text
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* No special content note */}
          {!hasDatabaseBlocks && !hasEmbeddedFiles && (
            <div className="text-sm text-muted-foreground py-2">
              This note has plain text content only. The duplicate will be an exact copy.
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={duplicateMutation.isPending}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicateMutation.isPending}
            className="min-h-[44px]"
          >
            {duplicateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
