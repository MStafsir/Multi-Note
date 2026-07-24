'use client';

// ============================================================
// MODUL 7: File Preview Modal
// Wraps FilePreview in a shadcn/ui Dialog component
// - Title shows file name
// - Max width responsive (w-full mobile, max-w-4xl desktop)
// - Close button via Dialog's built-in close
// ============================================================

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FilePreview } from './file-preview';

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

export function FilePreviewModal({
  open,
  onOpenChange,
  id,
  name,
  mimeType,
  sizeBytes,
}: FilePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
          <DialogDescription className="sr-only">
            File preview for {name}
          </DialogDescription>
        </DialogHeader>
        <FilePreview
          id={id}
          name={name}
          mimeType={mimeType}
          sizeBytes={sizeBytes}
        />
      </DialogContent>
    </Dialog>
  );
}
