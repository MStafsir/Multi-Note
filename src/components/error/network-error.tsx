'use client';

// ============================================================
// MODUL 26.3: Network Error Fallback
// Contextual fallback for network failures:
// - Shows retry with exponential backoff indicator
// - Displays attempt count and current retry delay
// - Actionable message, not raw error stack or white page
// ============================================================

import { useState, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRetry } from '@/hooks/use-retry';
import type { ErrorBoundaryFallbackProps } from './error-boundary';

interface NetworkErrorProps extends ErrorBoundaryFallbackProps {
  onRetrySuccess?: () => void;
  retryFn?: () => Promise<void>;
}

export function NetworkError({
  error,
  resetError,
  onRetrySuccess,
  retryFn,
}: NetworkErrorProps) {
  const [retryDelay, setRetryDelay] = useState(0);

  const retry = useRetry<void>(retryFn || (() => Promise.resolve()), {
    maxRetries: 3,
    baseDelay: 1000,
  });

  const handleRetry = useCallback(async () => {
    try {
      // Calculate expected delay for display
      setRetryDelay(1000);
      setTimeout(() => setRetryDelay(2000), 1000);
      setTimeout(() => setRetryDelay(4000), 3000);
      setTimeout(() => setRetryDelay(0), 7000);

      await retry.execute(retryFn || (() => Promise.resolve()));
      // Success — reset the error boundary and call success callback
      resetError();
      if (onRetrySuccess) {
        onRetrySuccess();
      }
    } catch {
      // All retries exhausted — error state remains
      setRetryDelay(0);
    }
  }, [retry, retryFn, resetError, onRetrySuccess]);

  const isNetworkError =
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('timeout') ||
    error.message.toLowerCase().includes('econn');

  const errorMessage = isNetworkError
    ? 'Unable to connect to the server. This might be a temporary network issue.'
    : 'A server error occurred. This might resolve on its own — please try again.';

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        {/* Network error icon */}
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Contextual message */}
        <div className="text-center">
          <p className="font-medium text-foreground">Connection issue</p>
          <p className="text-sm text-muted-foreground mt-1">
            {errorMessage}
          </p>
        </div>

        {/* Retry indicator */}
        {retry.isRetrying && (
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>
                Retrying... Attempt {retry.attemptCount} of {retry.maxAttempts}
              </span>
            </div>
            {retryDelay > 0 && (
              <span className="text-xs">
                Next retry in ~{retryDelay / 1000}s
              </span>
            )}
          </div>
        )}

        {/* Retry button */}
        {!retry.isRetrying && (
          <Button
            variant="default"
            size="sm"
            onClick={handleRetry}
            className="min-h-[44px]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry with auto-backoff
          </Button>
        )}

        {/* Manual reset option */}
        {!retry.isRetrying && retry.hasError && (
          <p className="text-xs text-muted-foreground">
            All retries exhausted.{' '}
            <button
              onClick={resetError}
              className="text-primary hover:text-primary/80 underline"
            >
              Reset and try again
            </button>
          </p>
        )}

        {/* Debug info (hidden by default, accessible via aria) */}
        <p className="sr-only" aria-live="polite">
          Error details: {error.message}. Retry attempts: {retry.attemptCount}.
        </p>
      </CardContent>
    </Card>
  );
}
