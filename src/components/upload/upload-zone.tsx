'use client';

// ============================================================
// MODUL 5: Upload Zone — Drag-and-drop file upload overlay
// Uses useUploadStore for drag state and upload progress
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { Upload, FileUp, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUploadStore } from '@/store/upload';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export function UploadZone() {
  const { isDragging, setDragging, uploads, clearCompleted } = useUploadStore();
  const uploadMutation = useUploadFile();
  const { currentFolderId } = useFileTreeStore();
  const dragCounterRef = useRef(0);

  // Drag enter/leave handlers with counter to handle nested elements
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setDragging(true);
    }
  }, [setDragging]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }, [setDragging]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragging(false);

    const files = e.dataTransfer?.files;
    if (files) {
      for (const file of Array.from(files)) {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      }
    }
  }, [setDragging, uploadMutation, currentFolderId]);

  // Register global drag listeners
  useEffect(() => {
    const target = document.body;

    target.addEventListener('dragenter', handleDragEnter);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('dragover', handleDragOver);
    target.addEventListener('drop', handleDrop);

    return () => {
      target.removeEventListener('dragenter', handleDragEnter);
      target.removeEventListener('dragleave', handleDragLeave);
      target.removeEventListener('dragover', handleDragOver);
      target.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  // Collect active uploads for display
  const activeUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'uploading' || u.status === 'error'
  );
  const hasActiveUploads = activeUploads.length > 0;

  return (
    <>
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-card p-12 shadow-2xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <FileUp className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Drop files here</p>
                <p className="text-sm text-muted-foreground">Files will be uploaded to the current folder</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress panel */}
      <AnimatePresence>
        {hasActiveUploads && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-40 w-80 rounded-lg border bg-card shadow-lg"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Uploading</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {activeUploads.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={clearCompleted}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto p-2">
              {activeUploads.map((upload) => (
                <div
                  key={upload.fileId}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{upload.fileName}</p>
                    {upload.status === 'uploading' && (
                      <Progress value={upload.progress} className="mt-1 h-1" />
                    )}
                    {upload.status === 'error' && (
                      <p className="text-xs text-destructive mt-0.5">{upload.error || 'Upload failed'}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {upload.status === 'uploading' && (
                      <span className="text-xs text-muted-foreground">{upload.progress}%</span>
                    )}
                    {upload.status === 'complete' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {upload.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
