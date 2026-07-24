// ============================================================
// MODUL 27: Request Tracer — Wraps API route handlers
// Measures duration_ms, auto-flags slow requests (> 1s),
// Captures user_id from x-user-id header, logs structured entry
// ============================================================

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { alertMonitor } from '@/lib/alert-monitor';

type HandlerFunction = (request: Request, ...args: unknown[]) => Promise<NextResponse | Response>;

interface TracedHandlerContext {
  userId: string | null;
  startTime: number;
}

/**
 * Wrap an API route handler with request tracing, structured logging, and alert monitoring.
 *
 * Usage:
 *   export const GET = traceHandler(async (req) => { ... })
 *   export const POST = traceHandler(async (req) => { ... })
 *   export const PATCH = traceHandler(async (req, { params }) => { ... }, true) // hasParams
 *
 * For handlers that need params (dynamic routes), set hasParams=true and pass
 * the second arg as the params context.
 */
export function traceHandler(
  handler: HandlerFunction,
  hasParams: boolean = false
) {
  return async function tracedHandler(
    request: Request,
    context?: unknown
  ): Promise<NextResponse | Response> {
    const startTime = performance.now();
    const userId = request.headers.get('x-user-id') || null;

    // Determine action name from URL path and method
    const url = new URL(request.url);
    const method = request.method;
    const pathSegments = url.pathname.replace('/api/', '').split('/');
    const action = `${method}_${pathSegments.join('_')}`;

    const traceContext: TracedHandlerContext = {
      userId,
      startTime,
    };

    try {
      // Call the original handler
      const args: unknown[] = [request];
      if (hasParams && context) {
        args.push(context);
      }
      const result = await handler(...args);

      // Calculate duration
      const durationMs = performance.now() - traceContext.startTime;

      // Determine if request was successful based on status code
      const statusCode = result.status;
      const isSuccess = statusCode >= 200 && statusCode < 400;

      // Log structured entry
      const logContext: Record<string, unknown> = {
        method,
        path: url.pathname,
        status_code: statusCode,
        slow_request: durationMs > 1000,
      };

      if (isSuccess) {
        logger.info(action, logContext, userId, Math.round(durationMs));
      } else {
        logger.warn(action, logContext, userId, Math.round(durationMs));

        // Track error in alert monitor
        alertMonitor.recordRequest(durationMs, statusCode >= 500);
      }

      // Auto-flag slow requests (> 1s)
      if (durationMs > 1000) {
        logger.warn('slow_request_detected', {
          original_action: action,
          duration_ms: Math.round(durationMs),
          path: url.pathname,
          method,
          status_code: statusCode,
        }, userId, Math.round(durationMs));
      }

      // Record in alert monitor
      alertMonitor.recordRequest(durationMs, false);

      return result;
    } catch (error: unknown) {
      const durationMs = performance.now() - traceContext.startTime;

      // Log error with full stack trace (PII still redacted)
      logger.error(
        action,
        {
          method,
          path: url.pathname,
          unexpected_error: true,
        },
        error,
        userId,
        Math.round(durationMs)
      );

      // Track error in alert monitor
      alertMonitor.recordRequest(durationMs, true);

      // Return generic error response
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  };
}

/**
 * Extract user ID from request headers
 */
export function getUserIdFromRequest(request: Request): string | null {
  return request.headers.get('x-user-id') || null;
}

/**
 * Extract user email from request headers (for admin checks)
 */
export function getUserEmailFromRequest(request: Request): string | null {
  return request.headers.get('x-user-email') || null;
}
