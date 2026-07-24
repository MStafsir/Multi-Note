// ============================================================
// MODUL 31: Database Block API — Get, Update, Delete single database
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateDatabaseSchema } from '@/lib/validators';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { rows: true, views: true, parentNote: true },
    });

    if (!database) {
      return NextResponse.json({ success: false, error: 'Database not found' }, { status: 404 });
    }

    // Verify ownership via parent note
    if (database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: database.id,
        parentNoteId: database.parentNoteId,
        title: database.title,
        schema: JSON.parse(database.schema),
        createdAt: database.createdAt.toISOString(),
        updatedAt: database.updatedAt.toISOString(),
        rows: database.rows.map(r => ({
          id: r.id,
          databaseId: r.databaseId,
          cellData: JSON.parse(r.cellData),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        views: database.views.map(v => ({
          id: v.id,
          type: v.type,
          name: v.name,
          config: JSON.parse(v.config),
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[databases] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateDatabaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });

    if (!database) {
      return NextResponse.json({ success: false, error: 'Database not found' }, { status: 404 });
    }

    if (database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title) updateData.title = parsed.data.title;
    if (parsed.data.schema) updateData.schema = JSON.stringify(parsed.data.schema);

    const updated = await db.noteDatabase.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        schema: JSON.parse(updated.schema),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });

    if (!database) {
      return NextResponse.json({ success: false, error: 'Database not found' }, { status: 404 });
    }

    if (database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    // Cascade delete rows and views
    await db.databaseRow.deleteMany({ where: { databaseId: id } });
    await db.databaseView.deleteMany({ where: { databaseId: id } });
    await db.noteDatabase.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[databases] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
