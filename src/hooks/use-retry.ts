'use client';

// ============================================================
// MODUL 26.3: useRetry Hook — React state management for retryWithBackoff
// Tracks: attempt count, error state, isRetrying status
// Provides: execute function that wraps async operations with retry
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { retryWithBackoff, type RetryOptions } from '@/lib/retry';

interface UseRetryState {
  isRetrying: boolean;
  attemptCount: number;
  maxAttempts: number;
  error: Error | null;
  hasError: boolean;
}

interface UseRetryReturn<T> extends UseRetryState {
  execute: (fn?: () => Promise<T>) => Promise<T>;
  reset: () => void;
}

export function useRetry<T>(
  defaultFn?: () => Promise<T>,
  options: RetryOptions = {}
): UseRetryReturn<T> {
  const maxRetries = options.maxRetries ?? 3;

  const [state, setState] = useState<UseRetryState>({
    isRetrying: false,
    attemptCount: 0,
    maxAttempts: maxRetries + 1,
    error: null,
    hasError: false,
  });

  const abortRef = useRef(false);

  const execute = useCallback(
    async (fn?: () => Promise<T>): Promise<T> => {
      const executeFn = fn || defaultFn;
      if (!executeFn) {
        throw new Error('No function provided to execute');
      }

      // Reset abort flag
      abortRef.current = false;

      setState((prev) => ({
        ...prev,
        isRetrying: true,
        attemptCount: 0,
        error: null,
        hasError: false,
      }));

      try {
        const result = await retryWithBackoff(executeFn, {
          ...options,
          shouldRetry: (error, attempt) => {
            // Check if aborted
            if (abortRef.current) return false;
            // Update attempt count
            setState((prev) => ({
              ...prev,
              attemptCount: attempt,
              error: error,
              // Don't mark hasError until final failure
              hasError: false,
            }));
            // Use original shouldRetry if provided
            if (options.shouldRetry) {
              return options.shouldRetry(error, attempt);
            }
            return true;
          },
        });

        setState({
          isRetrying: false,
          attemptCount: result.attempts,
          maxAttempts: maxRetries + 1,
          error: null,
          hasError: false,
        });

        return result.data;
      } catch (error) {
        const finalError = error instanceof Error ? error : new Error(String(error));

        setState({
          isRetrying: false,
          attemptCount: maxRetries + 1,
          maxAttempts: maxRetries + 1,
          error: finalError,
          hasError: true,
        });

        throw finalError;
      }
    },
    [defaultFn, options, maxRetries]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({
      isRetrying: false,
      attemptCount: 0,
      maxAttempts: maxRetries + 1,
      error: null,
      hasError: false,
    });
  }, [maxRetries]);

  return {
    ...state,
    execute,
    reset,
  };
}
