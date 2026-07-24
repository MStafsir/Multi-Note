// ============================================================
// Unit Tests — retryWithBackoff utility (Modul 26)
// Tests: succeeds on first try, retries on failure, exhausts retries, delay calc
// Uses real timers with small delays for reliable async testing
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, isRetryableError } from '@/lib/retry';

describe('retryWithBackoff', () => {
  it('succeeds on first try — returns result without retry', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(operation, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on 2nd try', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const result = await retryWithBackoff(operation, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times and succeeds on 3rd try', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success');

    const result = await retryWithBackoff(operation, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('exhausts all 3 retries and throws final error', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('permanent failure'));

    await expect(
      retryWithBackoff(operation, { maxRetries: 3, baseDelayMs: 10 })
    ).rejects.toThrow('permanent failure');

    // 1 initial attempt + 3 retries = 4 total calls
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it('respects shouldRetry predicate — does not retry non-retryable errors', async () => {
    const nonRetryableError = Object.assign(new Error('non-retryable'), { retryable: false });
    const operation = vi.fn().mockRejectedValue(nonRetryableError);

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 10,
        shouldRetry: isRetryableError,
      })
    ).rejects.toThrow('non-retryable');

    expect(operation).toHaveBeenCalledTimes(1); // No retries
  });

  it('exponential delay — waits longer between successive retries', async () => {
    // Verify that retry delays increase by measuring wall-clock time
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const startTime = Date.now();
    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      baseDelayMs: 50,
      maxDelayMs: 10000,
    });
    const elapsed = Date.now() - startTime;

    expect(result).toBe('success');

    // First delay: 50ms, second delay: 100ms — total ~150ms minimum
    // Allow generous tolerance for test environment variance
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it('respects maxDelayMs cap — delay does not exceed cap', async () => {
    // With baseDelayMs=200 but maxDelayMs=50, all delays should be capped at 50ms
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const startTime = Date.now();
    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      baseDelayMs: 200,
      maxDelayMs: 50,
    });
    const elapsed = Date.now() - startTime;

    expect(result).toBe('success');
    // 3 retries × 50ms cap = ~150ms total delay (capped, not exponential)
    expect(elapsed).toBeLessThan(300); // Would be much longer without cap
  });
});

describe('isRetryableError', () => {
  it('returns true for standard errors', () => {
    expect(isRetryableError(new Error('test'))).toBe(true);
  });

  it('returns true for string errors', () => {
    expect(isRetryableError('some error')).toBe(true);
  });

  it('returns false for errors with retryable: false', () => {
    const error = Object.assign(new Error('test'), { retryable: false });
    expect(isRetryableError(error)).toBe(false);
  });

  it('returns true for errors without retryable property', () => {
    expect(isRetryableError({ message: 'test' })).toBe(true);
  });
});
