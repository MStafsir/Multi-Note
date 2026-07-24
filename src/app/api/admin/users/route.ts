// ============================================================
// MODUL 36.3: Per-User Drill-Down API (for admin support)
// Returns: storage usage, last active, node count — NO content_json
// Privacy: does NOT include reading content_json of private notes
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { bigintToNumber } from '@/lib/bigint';

async function handleUserDrilldown(request: Request): Promise<NextResponse> {
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
  const targetUserId = searchParams.get('user_id');

  if (!targetUserId) {
    // Return list of all users with summary stats
    const allUsers = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        profile: { select: { storageUsedBytes: true, role: true } },
        nodes: {
          where: { deletedAt: null },
          select: { id: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get last activity for each user
    const lastActivities = await db.activityLog.groupBy({
      by: ['actorId'],
      _max: { createdAt: true },
    });

    const lastActivityMap = new Map(lastActivities.map(a => [a.actorId, a._max.createdAt]));

    const userList = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.profile?.role || 'user',
      storageUsedMB: Math.round((bigintToNumber(u.profile?.storageUsedBytes ?? BigInt(0)) ?? 0) / (1024 * 1024)),
      nodeCount: u.nodes.length,
      fileCount: u.nodes.filter(n => n.type === 'file').length,
      noteCount: u.nodes.filter(n => n.type === 'note').length,
      folderCount: u.nodes.filter(n => n.type === 'folder').length,
      lastActive: lastActivityMap.get(u.id)?.toISOString() || null,
      createdAt: u.createdAt.toISOString(),
    }));

    logger.info('admin_user_list_viewed', { count: userList.length }, userId);

    return NextResponse.json({
      success: true,
      data: { users: userList, total: userList.length },
    });
  }

  // Single user drill-down
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      profile: { select: { storageUsedBytes: true, quotaLimitBytes: true, role: true } },
      nodes: {
        where: { deletedAt: null },
        select: { id: true, type: true, name: true, createdAt: true, updatedAt: true },
      },
    },
  });

  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const lastActivity = await db.activityLog.findFirst({
    where: { actorId: targetUserId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, actionType: true },
  });

  // MODUL 36.3 — Privacy: NO content_json included for private notes
  // Only node metadata (name, type, timestamps) — not note content
  const userDetails = {
    id: targetUser.id,
    email: targetUser.email,
    name: targetUser.name,
    role: targetUser.profile?.role || 'user',
    storageUsedMB: Math.round((bigintToNumber(targetUser.profile?.storageUsedBytes ?? BigInt(0)) ?? 0) / (1024 * 1024)),
    storageLimitMB: Math.round((bigintToNumber(targetUser.profile?.quotaLimitBytes ?? BigInt(0)) ?? 0) / (1024 * 1024)),
    nodeCount: targetUser.nodes.length,
    nodes: targetUser.nodes.map(n => ({
      id: n.id,
      type: n.type,
      name: n.name,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      // Note: NO content_json field — privacy compliance (36.3)
    })),
    lastActive: lastActivity?.createdAt.toISOString() || null,
    lastAction: lastActivity?.actionType || null,
    createdAt: targetUser.createdAt.toISOString(),
  };

  logger.info('admin_user_drilldown', { targetUserId }, userId);

  return NextResponse.json({
    success: true,
    data: userDetails,
  });
}

export const GET = traceHandler(handleUserDrilldown);
