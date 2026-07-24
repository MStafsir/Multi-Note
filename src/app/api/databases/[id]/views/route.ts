// ============================================================
// MODUL 32: Database Views API — CRUD
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDatabaseViewSchema, updateDatabaseViewSchema } from '@/lib/validators';

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
      include: { parentNote: true },
    });
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const views = await db.databaseView.findMany({ where: { databaseId: id } });

    return NextResponse.json({
      success: true,
      data: views.map(v => ({
        id: v.id,
        databaseId: v.databaseId,
        type: v.type,
        name: v.name,
        config: JSON.parse(v.config),
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[databases/views] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createDatabaseViewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });

    const view = await db.databaseView.create({
      data: {
        databaseId: id,
        type: parsed.data.type,
        name: parsed.data.name,
        config: JSON.stringify(parsed.data.config ?? {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: view.id,
        databaseId: view.databaseId,
        type: view.type,
        name: view.name,
        config: JSON.parse(view.config),
        createdAt: view.createdAt.toISOString(),
        updatedAt: view.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases/views] POST error:', error);
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
  const viewId = request.nextUrl.searchParams.get('viewId');
  if (!viewId) return NextResponse.json({ success: false, error: 'viewId query param required' }, { status: 400 });

  try {
    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateDatabaseViewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.type) updateData.type = parsed.data.type;
    if (parsed.data.config) updateData.config = JSON.stringify(parsed.data.config);

    const updated = await db.databaseView.update({
      where: { id: viewId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        type: updated.type,
        name: updated.name,
        config: JSON.parse(updated.config),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases/views] PATCH error:', error);
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
  const viewId = request.nextUrl.searchParams.get('viewId');
  if (!viewId) return NextResponse.json({ success: false, error: 'viewId query param required' }, { status: 400 });

  try {
    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    await db.databaseView.delete({ where: { id: viewId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[databases/views] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
