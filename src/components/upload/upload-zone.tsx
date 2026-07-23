'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useUploadStore } from '@/store/upload';
import { useFileTreeStore } from '@/store/file-tree';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

export function UploadZone() {
  const uploadMutation = useUploadFile();
  const { uploads, isDragging, setDragging } = useUploadStore();
  const { currentFolderId } = useFileTreeStore();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      }
    },
    [uploadMutation, currentFolderId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragging(true),
    onDragLeave: () => setDragging(false),
    noClick: true, // Don't open file picker on click — just drag-and-drop
    noKeyboard: true,
  });

  // Convert Map entries to array for rendering
  const activeUploads = Array.from(uploads.entries()).filter(
    ([_, upload]) => upload.status === 'uploading' || upload.status === 'error'
  );

  return (
    <div>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          relative rounded-lg border-2 border-dashed transition-colors
          ${isDragActive || isDragging
            ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
            : 'border-muted-foreground/20 hover:border-muted-foreground/40'}
          p-4 mb-4
        `}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span className="text-sm">
            {isDragActive ? 'Drop files here...' : 'Drag & drop files to upload'}
          </span>
        </div>
      </div>

      {/* Upload progress indicators */}
      <AnimatePresence>
        {activeUploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 mb-4"
          >
            {activeUploads.map(([fileId, upload]) => (
              <motion.div
                key={fileId}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Status icon */}
                    {upload.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    )}
                    {upload.status === 'complete' && (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    {upload.status === 'error' && (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}

                    {/* File name */}
                    <span className="text-sm truncate flex-1 min-w-0">
                      {upload.fileName}
                    </span>

                    {/* Progress */}
                    {upload.status === 'uploading' && (
                      <Progress value={upload.progress} className="h-2 w-24 shrink-0" />
                    )}

                    {/* Error message */}
                    {upload.status === 'error' && upload.error && (
                      <span className="text-xs text-destructive shrink-0">
                        {upload.error}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
