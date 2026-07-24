// ============================================================
// Zustand Store — Upload progress state (Modul 5)
// ============================================================

import { create } from 'zustand';
import type { UploadProgress } from '@/types';

interface UploadState {
  uploads: Map<string, UploadProgress>;
  isDragging: boolean;

  addUpload: (upload: UploadProgress) => void;
  updateUpload: (fileId: string, updates: Partial<UploadProgress>) => void;
  removeUpload: (fileId: string) => void;
  clearCompleted: () => void;
  setDragging: (dragging: boolean) => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: new Map(),
  isDragging: false,

  addUpload: (upload) => {
    const uploads = new Map(get().uploads);
    uploads.set(upload.fileId, upload);
    set({ uploads });
  },

  updateUpload: (fileId, updates) => {
    const uploads = new Map(get().uploads);
    const current = uploads.get(fileId);
    if (current) {
      uploads.set(fileId, { ...current, ...updates });
      set({ uploads });
    }
  },

  removeUpload: (fileId) => {
    const uploads = new Map(get().uploads);
    uploads.delete(fileId);
    set({ uploads });
  },

  clearCompleted: () => {
    const uploads = new Map(get().uploads);
    for (const [key, upload] of uploads) {
      if (upload.status === 'complete' || upload.status === 'error') {
        uploads.delete(key);
      }
    }
    set({ uploads });
  },

  setDragging: (dragging) => set({ isDragging: dragging }),
}));
