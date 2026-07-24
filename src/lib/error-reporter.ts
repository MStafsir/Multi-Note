// ============================================================
// MODUL 26.4: Error Reporting Utility
// Structured error reporting with:
// - Captures: stack-trace, user_id, route, action, component_name, timestamp
// - Redacts: content_json (truncate to 100 chars), email (partial mask), passwords (remove)
// - Logs to structured logger (Module 27 will handle the logging itself)
// - reportError(error, context) function
// ============================================================

export interface ErrorContext {
  userId?: string;
  route?: string;
  action?: string;
  componentName?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stackTrace: string | null;
  timestamp: string;
  context: ErrorContext;
  redactedData: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// --- Data Redaction Utilities (26.4) ---

/**
 * Truncate content_json fields to first 100 chars.
 * Prevents logging full note content which may contain personal data.
 */
function redactContentJson(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...[REDACTED - truncated for privacy]';
  }
  return value;
}

/**
 * Partially mask email addresses.
 * e.g., "john.doe@example.com" → "j****@example.com"
 */
function redactEmail(email: string): string {
  if (!email || typeof email !== 'string') return email;
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const visibleChars = Math.min(local.length, 1);
  const maskedLocal = local.substring(0, visibleChars) + '****';
  return `${maskedLocal}@${domain}`;
}

/**
 * Remove password fields entirely.
 */
function redactPassword(value: unknown): string {
  return '[REMOVED]';
}

/**
 * Recursively redact sensitive fields in an object.
 */
function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Password fields: remove entirely
    if (lowerKey.includes('password') || lowerKey.includes('passwd') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('apikey')) {
      redacted[key] = redactPassword(value);
      continue;
    }

    // Email fields: partial mask
    if (lowerKey.includes('email') || lowerKey === 'mail') {
      if (typeof value === 'string') {
        redacted[key] = redactEmail(value);
      } else {
        redacted[key] = value;
      }
      continue;
    }

    // content_json fields: truncate to 100 chars
    if (lowerKey === 'contentjson' || lowerKey === 'content_json' || lowerKey === 'content') {
      redacted[key] = redactContentJson(value);
      continue;
    }

    // Recursively redact nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactObject(value as Record<string, unknown>);
      continue;
    }

    // Keep other values as-is
    redacted[key] = value;
  }

  return redacted;
}

/**
 * Determine error severity based on error type and context.
 */
function determineSeverity(error: Error, context: ErrorContext): ErrorReport['severity'] {
  const message = error.message.toLowerCase();

  // Critical: data loss, auth failures
  if (message.includes('delete') && message.includes('failed') && context.action === 'delete') {
    return 'critical';
  }
  if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
    return 'critical';
  }

  // High: server errors, save failures
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'high';
  }
  if (context.action === 'save' || context.action === 'upload') {
    return 'high';
  }

  // Medium: network errors, retries
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return 'medium';
  }

  // Low: everything else
  return 'low';
}

/**
 * Generate a unique error report ID.
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- Main Error Reporting Function (26.4) ---

/**
 * Report an error with full context and redacted data.
 *
 * @param error - The Error object to report
 * @param context - Additional context (user_id, route, action, component_name)
 * @returns The error report object (also logged to structured logger)
 */
export function reportError(error: Error, context: ErrorContext = {}): ErrorReport {
  const report: ErrorReport = {
    id: generateErrorId(),
    message: error.message,
    stackTrace: error.stack || null,
    timestamp: new Date().toISOString(),
    context: {
      ...context,
      // Redact userId doesn't need masking (it's an internal ID, not personal data)
    },
    redactedData: context.additionalData
      ? redactObject(context.additionalData)
      : {},
    severity: determineSeverity(error, context),
  };

  // Log the error report (structured logging)
  // Module 27 will handle the actual logging transport
  // For now, we log to console with structured format
  console.error('[ErrorReporter]', JSON.stringify(report, null, 2));

  // Also store in local storage for later retrieval if needed
  try {
    const storedReports = JSON.parse(localStorage.getItem('error_reports') || '[]');
    // Keep only last 50 reports to avoid storage overflow
    storedReports.push(report);
    if (storedReports.length > 50) {
      storedReports.splice(0, storedReports.length - 50);
    }
    localStorage.setItem('error_reports', JSON.stringify(storedReports));
  } catch {
    // Ignore storage errors (might be in SSR context or storage full)
  }

  return report;
}

/**
 * Get all stored error reports from localStorage.
 * Useful for debugging or sending to a logging service.
 */
export function getStoredErrorReports(): ErrorReport[] {
  try {
    return JSON.parse(localStorage.getItem('error_reports') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear all stored error reports from localStorage.
 */
export function clearStoredErrorReports(): void {
  try {
    localStorage.removeItem('error_reports');
  } catch {
    // Ignore
  }
}
