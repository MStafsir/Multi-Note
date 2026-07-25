'use client';

// ============================================================
// Upload Zone — drag-and-drop and click-to-upload file area
// Supports file selection via click or drag-and-drop
// Shows upload progress via useUploadFile mutation
// ============================================================

import { useCallback, useRef, useState } from 'react';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';
import { cn } from '@/lib/utils';

export function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFile();
  const { currentFolderId } = useFileTreeStore();

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      });
    },
    [uploadMutation, currentFolderId]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => {
        uploadMutation.mutate({ file, parentId: currentFolderId });
      });
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadMutation, currentFolderId]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={cn(
        'border-2 border-dashed rounded-lg p-4 mb-4 transition-colors cursor-pointer',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        uploadMutation.isPending && 'opacity-50 pointer-events-none'
      )}
      role="button"
      aria-label="Upload files by clicking or dragging"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center justify-center gap-2 text-center">
        {uploadMutation.isPending ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : isDragOver ? (
          <FileUp className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}

        <p className="text-sm font-medium text-muted-foreground">
          {isDragOver ? 'Drop files here' : 'Click or drag files to upload'}
        </p>
        <p className="text-xs text-muted-foreground/75">
          Any file type — stored in current folder
        </p>
      </div>
    </div>
  );
}
