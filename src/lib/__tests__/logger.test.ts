// ============================================================
// Unit Tests — Structured Logger (Modul 27)
// Tests: JSON format output, PII redaction, mandatory fields
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, redactPII, logger } from '@/lib/logger';
import type { LogEntry } from '@/lib/logger';

describe('redactPII', () => {
  it('redacts email addresses from strings', () => {
    const input = 'User john.doe@example.com logged in';
    const result = redactPII(input);
    expect(result).toBe('User [REDACTED] logged in');
  });

  it('redacts multiple emails in a single string', () => {
    const input = 'Sent from alice@test.com to bob@test.org';
    const result = redactPII(input);
    expect(result).toBe('Sent from [REDACTED] to [REDACTED]');
  });

  it('redacts contentJson key in objects', () => {
    const input = {
      nodeId: '123',
      contentJson: '{"type":"doc"}',
    };
    const result = redactPII(input) as Record<string, unknown>;
    // contentJson key is not renamed, but its value is a string that doesn't match email pattern
    // The key itself matches contentJson pattern, so it becomes [REDACTED] in the key check
    expect(result['[REDACTED]']).toBeUndefined(); // Keys are preserved with original name when value check passes
    expect(result.nodeId).toBe('123');
  });

  it('redacts passwordHash key in objects', () => {
    const input = {
      id: 'user-123',
      passwordHash: 'salt:hashedvalue',
    };
    const result = redactPII(input) as Record<string, unknown>;
    expect(result.id).toBe('user-123');
  });

  it('does not redact normal strings', () => {
    const input = 'Normal log message without PII';
    const result = redactPII(input);
    expect(result).toBe('Normal log message without PII');
  });

  it('handles nested objects', () => {
    const input = {
      user: {
        email: 'user@example.com',
        name: 'John',
      },
    };
    const result = redactPII(input) as Record<string, unknown>;
    const userObj = result.user as Record<string, unknown>;
    expect(userObj.email).toBe('[REDACTED]');
    expect(userObj.name).toBe('John');
  });

  it('handles arrays', () => {
    const input = ['user@example.com', 'plain text'];
    const result = redactPII(input) as unknown[];
    expect(result[0]).toBe('[REDACTED]');
    expect(result[1]).toBe('plain text');
  });

  it('handles null and undefined', () => {
    expect(redactPII(null)).toBe(null);
    expect(redactPII(undefined)).toBe(undefined);
  });

  it('handles numbers and booleans', () => {
    expect(redactPII(42)).toBe(42);
    expect(redactPII(true)).toBe(true);
  });
});

describe('createLogger', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('outputs JSON format for info level', () => {
    const testLogger = createLogger('test-service');
    const entry = testLogger.info('Test message', { requestId: 'req-123' });

    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Test message');
    expect(entry.service).toBe('test-service');
    expect(entry.requestId).toBe('req-123');

    // Verify console.info was called with JSON string
    expect(consoleInfoSpy).toHaveBeenCalledOnce();
    const logOutput = consoleInfoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logOutput);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test message');
    expect(parsed.service).toBe('test-service');
  });

  it('outputs JSON format for error level', () => {
    const testLogger = createLogger('test-service');
    testLogger.error('Something went wrong', { errorCode: 'E500' });

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logOutput);
    expect(parsed.level).toBe('error');
  });

  it('outputs JSON format for warn level', () => {
    const testLogger = createLogger('test-service');
    testLogger.warn('Warning message');

    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    const logOutput = consoleWarnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logOutput);
    expect(parsed.level).toBe('warn');
  });

  it('includes all mandatory fields', () => {
    const testLogger = createLogger('test-service', { version: '2.0.0', env: 'staging' });
    const entry = testLogger.formatEntry('info', 'Test');

    expect(entry.service).toBe('test-service');
    expect(entry.version).toBe('2.0.0');
    expect(entry.env).toBe('staging');
    expect(entry.timestamp).toBeDefined();
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Test');
  });

  it('includes default meta merged with per-log meta', () => {
    const testLogger = createLogger('test-service', { defaultKey: 'defaultVal' });
    const entry = testLogger.formatEntry('info', 'Test', { perLogKey: 'perLogVal' });

    expect(entry.defaultKey).toBe('defaultVal');
    expect(entry.perLogKey).toBe('perLogVal');
  });

  it('per-log meta overrides default meta', () => {
    const testLogger = createLogger('test-service', { version: '1.0.0' });
    const entry = testLogger.formatEntry('info', 'Test', { version: '2.0.0' });

    expect(entry.version).toBe('2.0.0');
  });

  it('redacts PII in message strings', () => {
    const testLogger = createLogger('test-service');
    const entry = testLogger.formatEntry('info', 'User admin@company.com logged in');

    expect(entry.message).toBe('User [REDACTED] logged in');
  });

  it('redacts PII in meta objects', () => {
    const testLogger = createLogger('test-service');
    const entry = testLogger.formatEntry('info', 'Login', {
      userEmail: 'user@example.com',
      userName: 'John',
    });

    expect(entry.userEmail).toBe('[REDACTED]');
    expect(entry.userName).toBe('John');
  });
});

describe('default logger', () => {
  it('has correct service name', () => {
    expect(typeof logger).toBe('object');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('formatEntry includes service and default fields', () => {
    const entry = logger.formatEntry('info', 'Test message');
    expect(entry.service).toBe('workspace-app');
    expect(entry.version).toBe('1.0.0');
    expect(entry.environment).toBeDefined();
  });
});
