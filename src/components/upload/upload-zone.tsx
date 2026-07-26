'use client';

// ============================================================
// MODUL 5: Upload Zone — Drag-and-drop + file input
// Shows overlay when files are dragged over the content area
// ============================================================

import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File, Loader2 } from 'lucide-react';
import { useUploadStore } from '@/store/upload';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';

export function UploadZone() {
  const { uploads, isDragging, setDragging, removeUpload } = useUploadStore();
  const uploadMutation = useUploadFile();
  const { currentFolderId } = useFileTreeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, [setDragging]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging false if leaving the entire zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragging(false);
    }
  }, [setDragging]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      uploadMutation.mutate({ file, parentId: currentFolderId });
    }
  }, [setDragging, uploadMutation, currentFolderId]);

  // Click to upload
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      uploadMutation.mutate({ file, parentId: currentFolderId });
    }

    // Reset input so same file can be uploaded again
    e.target.value = '';
  }, [uploadMutation, currentFolderId]);

  // Active uploads (not completed/errored that haven't been removed yet)
  const activeUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'uploading' || u.status === 'pending'
  );

  // Recently completed/errored (still showing)
  const recentUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'complete' || u.status === 'error'
  );

  return (
    <>
      {/* Invisible drag overlay covering the entire area */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-primary/5 border-4 border-primary/30 rounded-lg flex items-center justify-center"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Upload className="h-16 w-16 text-primary" />
              </motion.div>
              <p className="text-lg font-medium text-primary">
                Drop files here to upload
              </p>
              <p className="text-sm text-muted-foreground">
                Files will be uploaded to the current folder
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input for click-to-upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Upload progress indicators */}
      {(activeUploads.length > 0 || recentUploads.length > 0) && (
        <div className="mb-4 space-y-2">
          <AnimatePresence>
            {Array.from(uploads.values()).map((upload) => (
              <motion.div
                key={upload.fileId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border/50"
              >
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {upload.fileName}
                </span>

                {upload.status === 'uploading' && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {upload.progress}%
                    </span>
                  </div>
                )}

                {upload.status === 'complete' && (
                  <span className="text-xs text-green-600 ml-auto">Done</span>
                )}

                {upload.status === 'error' && (
                  <span className="text-xs text-red-500 ml-auto truncate max-w-[150px]">
                    {upload.error || 'Failed'}
                  </span>
                )}

                {(upload.status === 'complete' || upload.status === 'error') && (
                  <button
                    onClick={() => removeUpload(upload.fileId)}
                    className="p-0.5 hover:bg-muted rounded ml-1"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
