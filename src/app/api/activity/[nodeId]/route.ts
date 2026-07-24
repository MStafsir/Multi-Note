// ============================================================
// MODUL 19.3: Activity Log for Specific Node — Timeline per file/folder
// Dedicated endpoint for "Activity" tab in file/folder detail view
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess } from '@/lib/permissions';

// GET /api/activity/[nodeId] — Activity for specific node
export async function GET(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { nodeId } = await params;

    // Permission check: user must have at least view access to the node
    const accessResult = await checkNodeAccess(userId, nodeId, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200);
    const offset = Math.max(Number(searchParams.get('offset') || '0'), 0);

    const [entries, total] = await Promise.all([
      db.activityLog.findMany({
        where: { nodeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          node: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      db.activityLog.count({ where: { nodeId } }),
    ]);

    // Enrich with actor name
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
    const message = error instanceof Error ? error.message : 'Failed to fetch node activity';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
