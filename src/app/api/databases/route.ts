// ============================================================
// MODUL 31: Database Block API — Create & List
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDatabaseSchema } from '@/lib/validators';
import { checkNodeAccess } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createDatabaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    // Verify the parent note belongs to the user
    const accessResult = await checkNodeAccess(userId, parsed.data.parentNoteId, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Parent note not found or no edit access' }, { status: 404 });
    }

    const database = await db.noteDatabase.create({
      data: {
        parentNoteId: parsed.data.parentNoteId,
        title: parsed.data.title,
        schema: JSON.stringify(parsed.data.schema),
      },
    });

    // Create a default table view
    await db.databaseView.create({
      data: {
        databaseId: database.id,
        type: 'table',
        name: 'Default View',
        config: JSON.stringify({}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: database.id,
        parentNoteId: database.parentNoteId,
        title: database.title,
        schema: JSON.parse(database.schema),
        createdAt: database.createdAt.toISOString(),
        updatedAt: database.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases] Create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const noteId = request.nextUrl.searchParams.get('noteId');
    if (!noteId) {
      return NextResponse.json({ success: false, error: 'noteId query param required' }, { status: 400 });
    }

    // Verify note ownership/access
    const noteAccessResult = await checkNodeAccess(userId, noteId, 'view');
    if (!noteAccessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Note not found or no access' }, { status: 404 });
    }

    const databases = await db.noteDatabase.findMany({
      where: { parentNoteId: noteId },
      include: { views: true },
    });

    return NextResponse.json({
      success: true,
      data: databases.map(d => ({
        id: d.id,
        parentNoteId: d.parentNoteId,
        title: d.title,
        schema: JSON.parse(d.schema),
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        views: d.views.map(v => ({
          id: v.id,
          type: v.type,
          name: v.name,
          config: JSON.parse(v.config),
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    console.error('[databases] List error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
