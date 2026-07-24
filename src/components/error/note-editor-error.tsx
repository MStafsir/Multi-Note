'use client';

// ============================================================
// MODUL 26.2: Note Editor Error Fallback
// Contextual fallback for note editor failures:
// - Message explaining the error
// - Retry button to attempt loading again
// - NO blank screen or full-page crash
// ============================================================

import { PencilOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ErrorBoundaryFallbackProps } from './error-boundary';

export function NoteEditorError({
  error,
  resetError,
}: ErrorBoundaryFallbackProps) {
  // Determine the type of error to show appropriate message
  const isNetworkError =
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('timeout');

  const errorMessage = isNetworkError
    ? 'Unable to load this note due to a network issue. Please check your connection and try again.'
    : 'Something went wrong while loading this note. Your data is safe — please try again.';

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        {/* Note editor icon */}
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
          <PencilOff className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Contextual message */}
        <div className="text-center">
          <p className="font-medium text-foreground">Note editor unavailable</p>
          <p className="text-sm text-muted-foreground mt-1">
            {errorMessage}
          </p>
        </div>

        {/* Retry button */}
        <Button
          variant="default"
          size="sm"
          onClick={resetError}
          className="min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry loading note
        </Button>

        {/* Debug info (hidden by default, accessible via aria) */}
        <p className="sr-only" aria-live="polite">
          Error details: {error.message}
        </p>
      </CardContent>
    </Card>
  );
}
