'use client';

// ============================================================
// MODUL 5: Upload Zone Component
// Integrates react-dropzone for drag-and-drop file upload
// Shows progress overlay during uploads
// ============================================================

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useUploadStore } from '@/store/upload';
import { useFileTreeStore } from '@/store/file-tree';

export function UploadZone() {
  const [isDragActive, setIsDragActive] = useState(false);
  const uploadMutation = useUploadFile();
  const { currentFolderId } = useFileTreeStore();
  const { uploads, clearCompleted } = useUploadStore();

  const activeUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'uploading' || u.status === 'pending'
  );
  const completedUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'complete'
  );
  const failedUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'error'
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      }
    },
    [uploadMutation, currentFolderId]
  );

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    noClick: true, // Don't open file dialog on click — only drag-and-drop
    noKeyboard: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    maxSize: 500 * 1024 * 1024, // 500MB max
  });

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />

      {/* Drop overlay */}
      <AnimatePresence>
        {dropzoneActive || isDragActive ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
          >
            <div className="flex items-center gap-3 text-emerald-600">
              <Upload className="h-6 w-6" />
              <span className="text-sm font-medium">Drop files here to upload</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Upload progress indicators */}
      <AnimatePresence>
        {(activeUploads.length > 0 || completedUploads.length > 0 || failedUploads.length > 0) ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 space-y-2"
          >
            {activeUploads.map((upload) => (
              <div
                key={upload.fileId}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border"
              >
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm truncate flex-1">{upload.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {upload.progress > 0 ? `${upload.progress}%` : 'Starting...'}
                </span>
              </div>
            ))}
            {completedUploads.map((upload) => (
              <div
                key={upload.fileId}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm truncate flex-1">{upload.fileName}</span>
                <span className="text-xs text-emerald-600">Uploaded</span>
              </div>
            ))}
            {failedUploads.map((upload) => (
              <div
                key={upload.fileId}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm truncate flex-1">{upload.fileName}</span>
                <span className="text-xs text-destructive">{upload.error || 'Failed'}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => useUploadStore.getState().removeUpload(upload.fileId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {(completedUploads.length > 0 || failedUploads.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={clearCompleted}
              >
                Clear completed
              </Button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
