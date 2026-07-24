'use client';

// ============================================================
// MODUL 7: File Preview Component
// Renders file preview based on MIME type:
// - Images: <img> with lazy loading and spinner
// - PDFs: embedded iframe viewer or link
// - Videos: <video> tag with controls and preload="metadata"
// - Audio: simple audio tag
// - Unsupported: fallback icon + file name + size + download button
// ============================================================

import { useState } from 'react';
import {
  File,
  ImageIcon,
  Film,
  FileText,
  Music,
  Archive,
  Code,
  Presentation,
  Spreadsheet,
  FileQuestion,
  Download,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { getMimePreviewType, getMimeIcon, getMimeLabel, formatFileSize, type PreviewType, type IconName } from '@/lib/mime-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FilePreviewProps {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  onClose?: () => void;
}

// Icon component lookup map
const ICON_COMPONENTS: Record<IconName, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  File,
  Image: ImageIcon,
  Film,
  FileText,
  Music,
  Archive,
  Code,
  Presentation,
  Spreadsheet,
  FileQuestion,
};

export function FilePreview({ id, name, mimeType, sizeBytes, onClose }: FilePreviewProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const previewType = getMimePreviewType(mimeType);
  const iconName = getMimeIcon(mimeType);
  const mimeLabel = getMimeLabel(mimeType);
  const IconComponent = ICON_COMPONENTS[iconName] || FileQuestion;

  const previewUrl = `/api/preview/${id}`;
  const downloadUrl = `/api/upload/download/${id}`;

  // Render close button
  const closeButton = onClose ? (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
      onClick={onClose}
      aria-label="Close preview"
    >
      <X className="h-4 w-4" />
    </Button>
  ) : null;

  // --- Image Preview ---
  if (previewType === 'image') {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[200px] max-h-[70vh]">
        {closeButton}
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {imageError ? (
          <Card className="w-full max-w-md">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Failed to load image</p>
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download={name}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <img
            src={previewUrl}
            alt={name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            loading="lazy"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && <span>{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs">{mimeLabel}</span>
        </div>
      </div>
    );
  }

  // --- PDF Preview ---
  if (previewType === 'pdf') {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-red-500" />
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && (
            <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
          )}
          <Button variant="outline" size="sm" asChild className="ml-auto">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </a>
          </Button>
        </div>
        <iframe
          src={previewUrl}
          className="w-full rounded-lg border bg-white"
          style={{ minHeight: '500px', maxHeight: '70vh' }}
          title={`Preview of ${name}`}
        />
      </div>
    );
  }

  // --- Video Preview ---
  if (previewType === 'video') {
    return (
      <div className="relative flex flex-col items-center w-full">
        {closeButton}
        <video
          src={previewUrl}
          controls
          preload="metadata"
          className="max-w-full max-h-[70vh] rounded-lg"
          aria-label={`Video preview of ${name}`}
        >
          Your browser does not support video playback.
        </video>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <Film className="h-4 w-4" />
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && <span>{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs">{mimeLabel}</span>
        </div>
      </div>
    );
  }

  // --- Audio Preview ---
  if (previewType === 'audio') {
    return (
      <div className="relative flex flex-col items-center w-full p-6">
        {closeButton}
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Music className="h-8 w-8 text-muted-foreground" />
        </div>
        <span className="font-medium truncate max-w-xs mb-2">{name}</span>
        <audio
          src={previewUrl}
          controls
          preload="metadata"
          className="w-full max-w-md"
          aria-label={`Audio preview of ${name}`}
        >
          Your browser does not support audio playback.
        </audio>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          {sizeBytes && <span>{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs">{mimeLabel}</span>
        </div>
      </div>
    );
  }

  // --- Unsupported Type: Fallback ---
  return (
    <div className="relative flex flex-col items-center w-full p-6">
      {closeButton}
      <Card className="w-full max-w-md">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
            <IconComponent className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium truncate max-w-full">{name}</p>
            <p className="text-sm text-muted-foreground mt-1">{mimeLabel}</p>
            {sizeBytes && (
              <p className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            No preview available for this file type
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
