// ============================================================
// MODUL 78: Calendar API Route — Calendar entries (note + scheduledDate)
// GET  /api/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// POST /api/calendar — create a calendar entry
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { getWorkspaceScopeFilter } from '@/lib/workspace-scope';

// Helper: Format node for API response (same pattern as nodes/route.ts)
function formatNode(node: Record<string, unknown>) {
  const metadata = node.metadata as Record<string, unknown> | null;
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    parentId: node.parentId,
    ownerId: node.ownerId,
    isFavorite: node.isFavorite,
    scheduledDate: node.scheduledDate,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    deletedAt: node.deletedAt,
    metadata: metadata ? { ...metadata, sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null) } : null,
    content: node.note ? { nodeId: node.note.nodeId, contentJson: node.note.contentJson } : null,
  };
}

// GET /api/calendar?startDate=2026-08-01&endDate=2026-08-31
// Fetch calendar entries for a date range, grouped by date (YYYY-MM-DD)
async function handleGetCalendar(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(session.user.id);

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Parse dates and build range: scheduledDate >= startDate AND scheduledDate < endDate + 1 day
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // endDate+1day: exclusive upper bound so we include all entries on the end date
    const endDateExclusive = new Date(endDate);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);

    // Calendar entry = Node with type='note' AND scheduledDate IS NOT NULL
    const andConditions: Record<string, unknown>[] = [
      workspaceScopeFilter,
      { type: 'note' },
      { scheduledDate: { not: null } },
      { scheduledDate: { gte: startDate } },
      { scheduledDate: { lt: endDateExclusive } },
      { deletedAt: null },
    ];

    const entries = await db.node.findMany({
      where: { AND: andConditions },
      orderBy: { scheduledDate: 'asc' },
      include: {
        metadata: true,
        note: true,
      },
    });

    // Group entries by date (YYYY-MM-DD format as key)
    const grouped: Record<string, ReturnType<typeof formatNode>[]> = {};
    for (const entry of entries) {
      const scheduledDate = entry.scheduledDate as Date | null;
      if (!scheduledDate) continue;

      // Format as YYYY-MM-DD
      const year = scheduledDate.getFullYear();
      const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
      const day = String(scheduledDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(formatNode(entry as unknown as Record<string, unknown>));
    }

    logger.info('calendar_entries_fetched', { startDate: startDateStr, endDate: endDateStr, count: entries.length }, session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        startDate: startDateStr,
        endDate: endDateStr,
        entries: grouped,
      },
    });
  } catch (error: unknown) {
    logger.error('calendar_entries_fetch_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch calendar entries';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/calendar — Create a calendar entry (note with scheduledDate)
async function handleCreateCalendarEntry(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, scheduledDate, parentId, workspaceId, contentJson } = body as {
      name?: string;
      scheduledDate?: string;
      parentId?: string | null;
      workspaceId?: string | null;
      contentJson?: string;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!scheduledDate || typeof scheduledDate !== 'string') {
      return NextResponse.json(
        { success: false, error: 'scheduledDate is required (YYYY-MM-DD or ISO 8601)' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(scheduledDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid scheduledDate format. Use YYYY-MM-DD or ISO 8601' },
        { status: 400 }
      );
    }

    // MODUL 49.12a — workspaceId from request body
    const workspaceIdFromBody = workspaceId || null;

    // Check duplicate name in same parent scope
    const { workspaceScopeFilter } = await getWorkspaceScopeFilter(session.user.id);
    const duplicate = await db.node.findFirst({
      where: {
        AND: [
          workspaceScopeFilter,
          { parentId: parentId || null, name: name.trim(), type: 'note', deletedAt: null },
        ],
      },
    });

    if (duplicate) {
      logger.info('calendar_entry_create_duplicate', { name: name.trim(), parentId }, session.user.id);
      return NextResponse.json(
        { success: false, error: 'Note with this name already exists in this location' },
        { status: 409 }
      );
    }

    // Build note content JSON
    const noteContentJson = contentJson || JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });

    // Create Node with type='note', scheduledDate, and NoteContent
    const node = await db.node.create({
      data: {
        ownerId: session.user.id,
        workspaceId: workspaceIdFromBody,
        parentId: parentId || null,
        type: 'note',
        name: name.trim(),
        scheduledDate: parsedDate,
        note: {
          create: {
            contentJson: noteContentJson,
          },
        },
      },
      include: { metadata: true, note: true },
    });

    // Log activity
    await logActivity({
      actorId: session.user.id,
      nodeId: node.id,
      actionType: 'create',
      metadata: { type: 'note', name: name.trim(), scheduledDate: parsedDate.toISOString() },
    });

    logger.info('calendar_entry_created', { name: name.trim(), scheduledDate: parsedDate.toISOString(), nodeId: node.id }, session.user.id);

    return NextResponse.json({ success: true, data: formatNode(node as unknown as Record<string, unknown>) });
  } catch (error: unknown) {
    logger.error('calendar_entry_create_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to create calendar entry';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const GET = traceHandler(handleGetCalendar);
export const POST = traceHandler(handleCreateCalendarEntry);
