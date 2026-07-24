'use client';

// ============================================================
// MODUL 26.2: File Preview Error Fallback
// Contextual fallback for file preview failures:
// - Generic icon + "Preview unavailable" message
// - Download button so user can still access the file
// - NO blank screen or full-page crash
// ============================================================

import { FileQuestion, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ErrorBoundaryFallbackProps } from './error-boundary';

interface FilePreviewErrorProps extends ErrorBoundaryFallbackProps {
  fileName?: string;
  fileMimeType?: string;
  fileId?: string;
  downloadUrl?: string;
}

export function FilePreviewError({
  error,
  resetError,
  fileName = 'File',
  downloadUrl,
}: FilePreviewErrorProps) {
  const fullDownloadUrl = downloadUrl || (typeof window !== 'undefined' ? `/api/upload/download/${fileName}` : '#');

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        {/* Generic file icon */}
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* "Preview unavailable" message */}
        <div className="text-center">
          <p className="font-medium text-foreground">Preview unavailable</p>
          <p className="text-sm text-muted-foreground mt-1">
            We couldn&apos;t load the preview for this file.
          </p>
          {fileName && (
            <p className="text-xs text-muted-foreground mt-2">
              File: {fileName}
            </p>
          )}
        </div>

        {/* Download button — always available even when preview fails */}
        <div className="flex gap-3">
          <Button variant="outline" size="sm" asChild className="min-h-[44px]">
            <a href={fullDownloadUrl} download={fileName}>
              <Download className="h-4 w-4 mr-2" />
              Download file
            </a>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={resetError}
            className="min-h-[44px]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </div>

        {/* Debug info (hidden by default, accessible via aria) */}
        <p className="sr-only" aria-live="polite">
          Error details: {error.message}
        </p>
      </CardContent>
    </Card>
  );
}
