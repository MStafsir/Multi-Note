'use client';

// ============================================================
// MODUL 5: Upload Zone — Drag-and-drop file upload overlay
// Shows when user drags files over the content area
// ============================================================

import { useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useUploadStore } from '@/store/upload';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';

export function UploadZone() {
  const { isDragging, setDragging, uploads } = useUploadStore();
  const uploadMutation = useUploadFile();
  const { currentFolderId } = useFileTreeStore();
  const [internalDrag, setInternalDrag] = useState(false);

  // Show overlay when dragging files over the zone
  const showOverlay = isDragging || internalDrag;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalDrag(true);
    setDragging(true);
  }, [setDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if we're leaving the actual zone (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setInternalDrag(false);
      setDragging(false);
    }
  }, [setDragging]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalDrag(false);
    setDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      for (const file of Array.from(files)) {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      }
    }
  }, [uploadMutation, currentFolderId, setDragging]);

  // Active uploads display
  const activeUploads = Array.from(uploads.values()).filter(
    (u) => u.status === 'uploading' || u.status === 'pending'
  );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg">
          <div className="flex flex-col items-center gap-3 p-8">
            <Upload className="h-12 w-12 text-primary animate-bounce" />
            <p className="text-lg font-medium">Drop files here to upload</p>
            <p className="text-sm text-muted-foreground">
              Files will be uploaded to the current folder
            </p>
          </div>
        </div>
      )}

      {/* Upload progress indicators */}
      {activeUploads.length > 0 && !showOverlay && (
        <div className="flex flex-col gap-2 mb-4">
          {activeUploads.map((upload) => (
            <div
              key={upload.fileId}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
            >
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="truncate">{upload.fileName}</span>
              {upload.progress > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {upload.progress}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
