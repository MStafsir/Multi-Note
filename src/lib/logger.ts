// ============================================================
// MODUL 27: Structured JSON Logger
// Outputs JSON format, redacts PII, includes mandatory fields
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

// PII patterns to redact from log output
const PII_PATTERNS: RegExp[] = [
  /[a-zA-Z0._9+-]+@[a-zA-Z0._9-]+\.[a-zA-Z0._9-]+/gi,  // emails
  /contentJson/gi,                                          // note content field name
  /passwordHash/gi,                                         // password hash field name
];

const REDACTED = '[REDACTED]';

/**
 * Redact PII from a value by replacing sensitive patterns.
 */
export function redactPII(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const pattern of PII_PATTERNS) {
      result = result.replace(pattern, REDACTED);
    }
    return result;
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      // Redact keys that match PII patterns
      let redactedKey = key;
      for (const pattern of PII_PATTERNS) {
        if (pattern.test(key)) {
          redactedKey = REDACTED;
          break;
        }
        pattern.lastIndex = 0; // Reset regex state
      }
      redacted[redactedKey === REDACTED ? key : redactedKey] = redactPII(val);
    }
    return redacted;
  }

  return value;
}

/**
 * Create a structured logger instance for a given service.
 */
export function createLogger(service: string, defaultMeta?: Record<string, unknown>) {
  const mandatoryFields: Record<string, unknown> = {
    service,
    ...(defaultMeta || {}),
  };

  function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    const combinedMeta = { ...mandatoryFields, ...meta };
    const redactedMeta = redactPII(combinedMeta) as Record<string, unknown>;

    return {
      timestamp: new Date().toISOString(),
      level,
      message: redactPII(message) as string,
      ...redactedMeta,
    };
  }

  function output(entry: LogEntry): void {
    const json = JSON.stringify(entry);
    switch (entry.level) {
      case 'debug':
        // Debug only in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(json);
        }
        break;
      case 'info':
        console.info(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'error':
      case 'fatal':
        console.error(json);
        break;
    }
  }

  return {
    debug(message: string, meta?: Record<string, unknown>): LogEntry {
      const entry = formatEntry('debug', message, meta);
      output(entry);
      return entry;
    },
    info(message: string, meta?: Record<string, unknown>): LogEntry {
      const entry = formatEntry('info', message, meta);
      output(entry);
      return entry;
    },
    warn(message: string, meta?: Record<string, unknown>): LogEntry {
      const entry = formatEntry('warn', message, meta);
      output(entry);
      return entry;
    },
    error(message: string, meta?: Record<string, unknown>): LogEntry {
      const entry = formatEntry('error', message, meta);
      output(entry);
      return entry;
    },
    fatal(message: string, meta?: Record<string, unknown>): LogEntry {
      const entry = formatEntry('fatal', message, meta);
      output(entry);
      return entry;
    },
    /** Format entry without outputting — useful for testing */
    formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
      return formatEntry(level, message, meta);
    },
  };
}

// Default app-level logger
export const logger = createLogger('workspace-app', {
  version: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
});
