// ============================================================
// MODUL 36.5: Export Admin Reports — CSV/PDF periodic reports
// Reuses notification infrastructure (Modul 20.4) for scheduled email
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { bigintToNumber } from '@/lib/bigint';

async function handleExport(request: Request): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv'; // 'csv' | 'json'
  const type = searchParams.get('type') || 'metrics'; // 'metrics' | 'users' | 'activity'

  if (type === 'users') {
    // Export user list
    const allUsers = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        profile: { select: { storageUsedBytes: true, role: true } },
        nodes: { where: { deletedAt: null }, select: { id: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lastActivities = await db.activityLog.groupBy({
      by: ['actorId'],
      _max: { createdAt: true },
    });
    const lastActivityMap = new Map(lastActivities.map(a => [a.actorId, a._max.createdAt]));

    const userData = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name || '',
      role: u.profile?.role || 'user',
      storageUsedMB: Math.round((bigintToNumber(u.profile?.storageUsedBytes ?? BigInt(0)) ?? 0) / (1024 * 1024)),
      nodeCount: u.nodes.length,
      lastActive: lastActivityMap.get(u.id)?.toISOString() || '',
      createdAt: u.createdAt.toISOString(),
    }));

    if (format === 'csv') {
      const headers = ['ID', 'Email', 'Name', 'Role', 'Storage MB', 'Node Count', 'Last Active', 'Created At'];
      const csvRows = userData.map(row =>
        [row.id, row.email, row.name, row.role, row.storageUsedMB, row.nodeCount, row.lastActive, row.createdAt]
          .map(v => `"${v}"`).join(',')
      );
      const csv = [headers.join(','), ...csvRows].join('\n');

      logger.info('admin_export_users_csv', { count: userData.length }, userId);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="users-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: userData });
  }

  if (type === 'metrics') {
    // Export metrics snapshots
    const snapshots = await db.analyticsSnapshot.findMany({
      orderBy: { snapshotDate: 'desc' },
      take: 30,
    });

    const metricsData = snapshots.map(s => ({
      date: s.snapshotDate,
      dau: s.dauCount,
      mau: s.mauCount,
      totalStorageMB: Math.round(bigintToNumber(s.totalStorageBytes) / (1024 * 1024)),
      totalUsers: s.totalUsers,
      totalNodes: s.totalNodes,
      uploads: s.uploadsPerDay,
      notesCreated: s.notesCreatedPerDay,
      errorRate: s.errorRate,
      avgLatencyMs: s.avgLatencyMs,
    }));

    if (format === 'csv') {
      const headers = ['Date', 'DAU', 'MAU', 'Total Storage MB', 'Total Users', 'Total Nodes', 'Uploads', 'Notes Created', 'Error Rate', 'Avg Latency ms'];
      const csvRows = metricsData.map(row =>
        [row.date, row.dau, row.mau, row.totalStorageMB, row.totalUsers, row.totalNodes, row.uploads, row.notesCreated, row.errorRate, row.avgLatencyMs]
          .map(v => `"${v}"`).join(',')
      );
      const csv = [headers.join(','), ...csvRows].join('\n');

      logger.info('admin_export_metrics_csv', { count: metricsData.length }, userId);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="metrics-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: metricsData });
  }

  if (type === 'activity') {
    // MODUL 36.6 — Cross-reference activity_log for incident investigation
    const limit = parseInt(searchParams.get('limit') || '1000');
    const activityLogs = await db.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        actorId: true,
        nodeId: true,
        actionType: true,
        metadata: true,
        createdAt: true,
      },
    });

    const activityData = activityLogs.map(a => ({
      id: a.id,
      actorId: a.actorId,
      nodeId: a.nodeId || '',
      actionType: a.actionType,
      metadata: a.metadata || '',
      createdAt: a.createdAt.toISOString(),
    }));

    if (format === 'csv') {
      const headers = ['ID', 'Actor ID', 'Node ID', 'Action Type', 'Metadata', 'Created At'];
      const csvRows = activityData.map(row =>
        [row.id, row.actorId, row.nodeId, row.actionType, row.metadata, row.createdAt]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers.join(','), ...csvRows].join('\n');

      logger.info('admin_export_activity_csv', { count: activityData.length }, userId);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activity-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: activityData });
  }

  return NextResponse.json({ success: false, error: 'Invalid export type' }, { status: 400 });
}

export const GET = traceHandler(handleExport);
