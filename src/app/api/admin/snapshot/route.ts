// ============================================================
// MODUL 36.2: Analytics Snapshot Refresh API
// Pre-computed metrics to avoid heavy real-time queries on every load
// Called on scheduled basis (not real-time) — admin-triggered or cron
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { bigintToNumber } from '@/lib/bigint';
import { alertMonitor } from '@/lib/alert-monitor';

async function handleSnapshotRefresh(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (userRole !== 'admin') {
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { role: true },
    });
    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden — Admin access required' }, { status: 403 });
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Compute all metrics
  // DAU — users with activity today
  const dauUsers = await db.activityLog.findMany({
    where: { createdAt: { gte: todayStart } },
    select: { actorId: true },
    distinct: ['actorId'],
  });
  const dauCount = dauUsers.length;

  // MAU — users with activity in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const mauUsers = await db.activityLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { actorId: true },
    distinct: ['actorId'],
  });
  const mauCount = mauUsers.length;

  // Total storage
  const profiles = await db.profile.findMany({ select: { storageUsedBytes: true } });
  const totalStorageBytes = profiles.reduce((sum, p) => sum + bigintToNumber(p.storageUsedBytes) ?? 0, 0);

  // Totals
  const totalUsers = await db.user.count();
  const totalNodes = await db.node.count({ where: { deletedAt: null } });

  // Uploads & notes today
  const uploadsPerDay = await db.node.count({
    where: { type: 'file', createdAt: { gte: todayStart }, deletedAt: null },
  });
  const notesCreatedPerDay = await db.node.count({
    where: { type: 'note', createdAt: { gte: todayStart }, deletedAt: null },
  });

  // Error rate & latency from monitor
  const metricsSummary = alertMonitor.getMetricsSummary();

  // Upsert snapshot for today
  await db.analyticsSnapshot.upsert({
    where: { snapshotDate: today },
    create: {
      snapshotDate: today,
      dauCount,
      mauCount,
      totalStorageBytes: BigInt(totalStorageBytes),
      totalUsers,
      totalNodes,
      uploadsPerDay,
      notesCreatedPerDay,
      errorRate: metricsSummary.errorRate,
      avgLatencyMs: metricsSummary.avgLatencyMs,
    },
    update: {
      dauCount,
      mauCount,
      totalStorageBytes: BigInt(totalStorageBytes),
      totalUsers,
      totalNodes,
      uploadsPerDay,
      notesCreatedPerDay,
      errorRate: metricsSummary.errorRate,
      avgLatencyMs: metricsSummary.avgLatencyMs,
    },
  });

  logger.info('admin_snapshot_refreshed', { snapshotDate: today, dauCount, mauCount }, userId);

  return NextResponse.json({
    success: true,
    data: {
      snapshotDate: today,
      dauCount,
      mauCount,
      totalStorageBytes,
      totalUsers,
      totalNodes,
      uploadsPerDay,
      notesCreatedPerDay,
      errorRate: metricsSummary.errorRate,
      avgLatencyMs: metricsSummary.avgLatencyMs,
    },
  });
}

export const POST = traceHandler(handleSnapshotRefresh);
