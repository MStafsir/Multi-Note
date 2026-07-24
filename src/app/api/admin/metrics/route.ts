// ============================================================
// MODUL 36: Admin Metrics Dashboard API
// Role-based access: requires profile.role = admin (36.7 middleware defense-in-depth)
// Metrics: DAU/MAU, total storage, uploads/day, time-series data
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { alertMonitor } from '@/lib/alert-monitor';
import { traceHandler } from '@/lib/request-tracer';
import { bigintToNumber } from '@/lib/bigint';

async function handleMetricsRequest(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // MODUL 36.7 — Defense-in-depth: middleware already checks role, but verify again here
  if (userRole !== 'admin') {
    // Double-check from database (JWT could be stale)
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { role: true },
    });
    if (profile?.role !== 'admin') {
      logger.warn('admin_access_denied', { path: '/api/admin/metrics', attempted_by: userId }, userId);
      return NextResponse.json({ success: false, error: 'Forbidden — Admin access required' }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d'; // '7d' | '30d' | '90d'

  // 1. DAU — Daily Active Users (users with activity in last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeUsers24h = await db.activityLog.findMany({
    where: { createdAt: { gte: twentyFourHoursAgo } },
    select: { actorId: true },
    distinct: ['actorId'],
  });
  const dauCount = activeUsers24h.length;

  // 2. MAU — Monthly Active Users (users with activity in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeUsers30d = await db.activityLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { actorId: true },
    distinct: ['actorId'],
  });
  const mauCount = activeUsers30d.length;

  // 3. Total storage used platform-wide
  const profiles = await db.profile.findMany({
    select: { storageUsedBytes: true },
  });
  const totalStorageUsed = profiles.reduce((sum, p) => sum + (bigintToNumber(p.storageUsedBytes) ?? 0), 0);

  // 4. Uploads and notes created per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const uploadsToday = await db.node.count({
    where: { type: 'file', createdAt: { gte: todayStart }, deletedAt: null },
  });
  const notesCreatedToday = await db.node.count({
    where: { type: 'note', createdAt: { gte: todayStart }, deletedAt: null },
  });

  // 5. Time-series data: get recent AnalyticsSnapshots for charts
  const daysBack = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString().split('T')[0];

  const snapshots = await db.analyticsSnapshot.findMany({
    where: { snapshotDate: { gte: startDateStr } },
    orderBy: { snapshotDate: 'asc' },
  });

  // Build time-series array (fill gaps with computed data if no snapshot)
  const timeSeries: Array<{
    date: string;
    dau: number;
    mau: number;
    totalStorageMB: number;
    uploads: number;
    notesCreated: number;
    errorRate: number;
    avgLatency: number;
  }> = [];

  for (let i = 0; i < daysBack; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const snapshot = snapshots.find(s => s.snapshotDate === dateStr);

    if (snapshot) {
      timeSeries.push({
        date: dateStr,
        dau: snapshot.dauCount,
        mau: snapshot.mauCount,
        totalStorageMB: Math.round(bigintToNumber(snapshot.totalStorageBytes) / (1024 * 1024)),
        uploads: snapshot.uploadsPerDay,
        notesCreated: snapshot.notesCreatedPerDay,
        errorRate: snapshot.errorRate,
        avgLatency: snapshot.avgLatencyMs,
      });
    } else {
      // No snapshot for this date — compute on-the-fly (lighter than full scan)
      const dayStart = date;
      const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const dayActiveUsers = await db.activityLog.findMany({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
        select: { actorId: true },
        distinct: ['actorId'],
      });
      const dayUploads = await db.node.count({
        where: { type: 'file', createdAt: { gte: dayStart, lt: dayEnd }, deletedAt: null },
      });
      const dayNotes = await db.node.count({
        where: { type: 'note', createdAt: { gte: dayStart, lt: dayEnd }, deletedAt: null },
      });

      timeSeries.push({
        date: dateStr,
        dau: dayActiveUsers.length,
        mau: mauCount, // approximate — use current MAU
        totalStorageMB: Math.round(totalStorageUsed / (1024 * 1024)),
        uploads: dayUploads,
        notesCreated: dayNotes,
        errorRate: 0,
        avgLatency: 0,
      });
    }
  }

  // 6. Error rate and latency from alert monitor (current)
  const metricsSummary = alertMonitor.getMetricsSummary();

  // 7. Total users & nodes
  const totalUsers = await db.user.count();
  const totalNodes = await db.node.count({ where: { deletedAt: null } });

  logger.info('admin_metrics_viewed', { dauCount, mauCount, totalStorageUsed, range }, userId);

  return NextResponse.json({
    success: true,
    data: {
      // Current snapshot
      dauCount,
      mauCount,
      totalStorageUsed,
      totalStorageUsedMB: Math.round(totalStorageUsed / (1024 * 1024)),
      uploadsPerDay: uploadsToday,
      notesCreatedPerDay: notesCreatedToday,
      errorRate: metricsSummary.errorRate,
      errorCount: metricsSummary.errorCount,
      p99LatencyMs: metricsSummary.p99LatencyMs,
      p50LatencyMs: metricsSummary.p50LatencyMs,
      avgLatencyMs: metricsSummary.avgLatencyMs,
      requestCount5min: metricsSummary.requestCount,
      totalUsers,
      totalNodes,
      // Time-series for charts
      timeSeries,
      range,
    },
  });
}

export const GET = traceHandler(handleMetricsRequest);
