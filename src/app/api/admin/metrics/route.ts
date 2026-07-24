// ============================================================
// MODUL 27: Admin Metrics Dashboard API
// Returns: totalActiveUsers, totalStorageUsed, uploadsPerDay,
//          errorRate, p99Latency — business monitoring only
// Protected by admin check (first registered user)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { alertMonitor } from '@/lib/alert-monitor';
import { traceHandler } from '@/lib/request-tracer';
import { bigintToNumber } from '@/lib/bigint';

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

async function handleMetricsRequest(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Admin check
  const isUserAdmin = await isAdmin(userId);
  if (!isUserAdmin) {
    logger.warn('admin_access_denied', { path: '/api/admin/metrics', attempted_by: userId }, userId);
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  // 1. Total active users (users with activity in last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeUsers = await db.activityLog.findMany({
    where: { createdAt: { gte: twentyFourHoursAgo } },
    select: { actorId: true },
    distinct: ['actorId'],
  });
  const totalActiveUsers = activeUsers.length;

  // 2. Total storage used platform-wide (sum of storageUsedBytes from all profiles)
  const profiles = await db.profile.findMany({
    select: { storageUsedBytes: true },
  });
  const totalStorageUsed = profiles.reduce((sum, p) => sum + bigintToNumber(p.storageUsedBytes) ?? 0, 0);

  // 3. Uploads per day (count of file-type nodes created today)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const uploadsToday = await db.node.count({
    where: {
      type: 'file',
      createdAt: { gte: todayStart },
      deletedAt: null,
    },
  });

  // 4. Error rate and p99 latency from alert monitor
  const metricsSummary = alertMonitor.getMetricsSummary();

  // 5. Total users on platform
  const totalUsers = await db.user.count();

  // 6. Total nodes on platform
  const totalNodes = await db.node.count({
    where: { deletedAt: null },
  });

  logger.info('admin_metrics_viewed', { totalActiveUsers, totalStorageUsed, uploadsToday }, userId);

  return NextResponse.json({
    success: true,
    data: {
      totalActiveUsers,
      totalStorageUsed,
      totalStorageUsedMB: Math.round(totalStorageUsed / (1024 * 1024)),
      uploadsPerDay: uploadsToday,
      errorRate: metricsSummary.errorRate,
      errorCount: metricsSummary.errorCount,
      p99LatencyMs: metricsSummary.p99LatencyMs,
      p50LatencyMs: metricsSummary.p50LatencyMs,
      avgLatencyMs: metricsSummary.avgLatencyMs,
      requestCount5min: metricsSummary.requestCount,
      totalUsers,
      totalNodes,
    },
  });
}

export const GET = traceHandler(handleMetricsRequest);
