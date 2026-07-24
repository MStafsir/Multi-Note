// ============================================================
// MODUL 27: Admin Logs Query API
// Query structured logs from memory buffer
// Query params: user_id, level, action, limit, offset
// Protected by admin check (first registered user)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger, queryLogs } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import type { LogLevel } from '@/lib/logger';

/**
 * Check if the requesting user is an admin.
 * Admin = first registered user (lowest createdAt)
 */
async function isAdmin(userId: string): Promise<boolean> {
  const firstUser = await db.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return firstUser?.id === userId;
}

async function handleLogsRequest(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Admin check
  const isUserAdmin = await isAdmin(userId);
  if (!isUserAdmin) {
    logger.warn('admin_access_denied', { path: '/api/admin/logs', attempted_by: userId }, userId);
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const filters: {
    user_id?: string;
    level?: LogLevel;
    action?: string;
    limit?: number;
    offset?: number;
  } = {};

  const userIdFilter = searchParams.get('user_id');
  if (userIdFilter) filters.user_id = userIdFilter;

  const levelFilter = searchParams.get('level');
  if (levelFilter && ['info', 'error', 'debug', 'warn'].includes(levelFilter)) {
    filters.level = levelFilter as LogLevel;
  }

  const actionFilter = searchParams.get('action');
  if (actionFilter) filters.action = actionFilter;

  const limitParam = searchParams.get('limit');
  if (limitParam) filters.limit = parseInt(limitParam, 10);

  const offsetParam = searchParams.get('offset');
  if (offsetParam) filters.offset = parseInt(offsetParam, 10);

  // Query log buffer
  const logs = queryLogs(filters);
  const total = queryLogs({ ...filters, limit: undefined, offset: undefined }).length;

  logger.info('admin_logs_viewed', { filters, resultCount: logs.length, total }, userId);

  return NextResponse.json({
    success: true,
    data: {
      logs,
      total,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    },
  });
}

export const GET = traceHandler(handleLogsRequest);
