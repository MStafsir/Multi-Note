// ============================================================
// MODUL 19: Activity Log API — GET entries for user or node
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/activity — Get activity log entries
// Query params: nodeId (optional), limit (default 50), offset
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const nodeId = searchParams.get('nodeId') || undefined;
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200);
    const offset = Math.max(Number(searchParams.get('offset') || '0'), 0);

    // Build where clause
    // If nodeId provided: get all ActivityLog entries for that node (19.3 — timeline per file/folder)
    // If no nodeId: get all activity for current user (actorId = userId)
    const where = nodeId
      ? { nodeId }
      : { actorId: userId };

    const [entries, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          node: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      db.activityLog.count({ where }),
    ]);

    // Enrich with actor name (lookup from User table)
    // Batch fetch all unique actor IDs
    const actorIds = [...new Set(entries.map(e => e.actorId))];
    const actors = await db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const actorMap = new Map(actors.map(a => [a.id, a]));

    // Parse metadata JSON string back to object
    const formattedEntries = entries.map(entry => ({
      id: entry.id,
      actorId: entry.actorId,
      actorName: actorMap.get(entry.actorId)?.name || null,
      actorEmail: actorMap.get(entry.actorId)?.email || null,
      nodeId: entry.nodeId,
      nodeName: entry.node?.name || null,
      nodeType: entry.node?.type || null,
      actionType: entry.actionType,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
      createdAt: entry.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        entries: formattedEntries,
        total,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activity log';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
