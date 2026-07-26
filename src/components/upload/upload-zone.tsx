'use client';

import { useCallback, useRef } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { useUploadStore } from '@/store/upload';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';
import { motion, AnimatePresence } from 'framer-motion';

export function UploadZone() {
  const { uploads, isDragging, setDragging } = useUploadStore();
  const uploadMutation = useUploadFile();
  const { currentFolderId } = useFileTreeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'uploading' || u.status === 'pending'
  );
  const recentUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'complete' || u.status === 'error'
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
    },
    [setDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
    },
    [setDragging]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      }
    },
    [uploadMutation, currentFolderId, setDragging]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [uploadMutation, currentFolderId]
  );

  // Only show the drag overlay when dragging
  if (!isDragging && activeUploads.length === 0 && recentUploads.length === 0) {
    return (
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
      />

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary bg-background p-12">
              <Upload className="h-12 w-12 text-primary" />
              <p className="text-lg font-medium">Drop files here to upload</p>
              <p className="text-sm text-muted-foreground">
                Files will be uploaded to the current folder
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress list */}
      {(activeUploads.length > 0 || recentUploads.length > 0) && (
        <div className="mb-4 space-y-2">
          <AnimatePresence>
            {activeUploads.map((upload) => (
              <motion.div
                key={upload.fileId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <File className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.fileName}</p>
                  {upload.status === 'uploading' && (
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </motion.div>
            ))}
            {recentUploads.map((upload) => (
              <motion.div
                key={upload.fileId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <File className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.fileName}</p>
                  {upload.status === 'error' && upload.error && (
                    <p className="text-xs text-destructive">{upload.error}</p>
                  )}
                </div>
                {upload.status === 'complete' ? (
                  <span className="text-xs text-green-600 font-medium">Done</span>
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
