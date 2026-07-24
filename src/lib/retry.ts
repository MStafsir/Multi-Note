// ============================================================
// MODUL 26: Retry with Exponential Backoff
// Utility for resilient API calls that auto-retry on failure
// ============================================================

export interface RetryOptions {
  maxRetries: number;       // Maximum number of retry attempts (default: 3)
  baseDelayMs: number;      // Base delay in milliseconds (default: 1000)
  maxDelayMs: number;       // Maximum delay cap in milliseconds (default: 10000)
  shouldRetry?: (error: unknown) => boolean; // Predicate to decide if error is retryable
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Execute an async operation with exponential backoff retry.
 * - On success: returns the result immediately.
 * - On retryable failure: waits with exponential delay, then retries.
 * - On non-retryable failure or after exhausting retries: throws the final error.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, baseDelayMs, maxDelayMs, shouldRetry } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // If we've exhausted all retries, throw the final error
      if (attempt >= maxRetries) {
        throw error;
      }

      // Calculate exponential delay: baseDelay * 2^attempt, capped at maxDelay
      const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Simple sleep utility for delays.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default predicate: retry on all errors unless explicitly marked as non-retryable.
 * Errors with `retryable: false` property are considered non-retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (err.retryable === false) return false;
  }
  return true;
}
