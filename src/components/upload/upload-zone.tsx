// ============================================================
// Upload Zone Component — Drag & drop file upload zone
// Used in ContentArea when no note is selected
// ============================================================

'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, File, Loader2, AlertCircle } from 'lucide-react';
import { useUploadFile } from '@/hooks/use-file-tree';
import { useFileTreeStore } from '@/store/file-tree';
import { motion } from 'framer-motion';

interface UploadZoneProps {
  parentId?: string | null;
}

export function UploadZone({ parentId }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadFile();
  const { selectedNodeId } = useFileTreeStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsUploading(true);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    try {
      for (const file of files) {
        await uploadFile.mutateAsync({
          file,
          parentId: parentId || selectedNodeId || null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [parentId, selectedNodeId, uploadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (const file of files) {
        await uploadFile.mutateAsync({
          file,
          parentId: parentId || selectedNodeId || null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [parentId, selectedNodeId, uploadFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex items-center justify-center p-8"
    >
      <div
        className={`w-full max-w-md rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer
          ${isDragOver
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-border hover:border-muted-foreground'
          }
          ${isUploading ? 'opacity-60 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Upload files by dropping here or clicking to select"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm text-red-500">{error}</p>
            <p className="text-xs text-muted-foreground">Click to try again</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here to upload</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          aria-hidden="true"
        />
      </div>
    </motion.div>
  );
}
