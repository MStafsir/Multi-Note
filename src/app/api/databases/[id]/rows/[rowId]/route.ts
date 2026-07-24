// ============================================================
// MODUL 31: Single Database Row — GET, PATCH, DELETE
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateRowSchema } from '@/lib/validators';
import { evaluateFormula, validateCellData } from '@/lib/formula-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id, rowId } = await params;

  try {
    const row = await db.databaseRow.findUnique({ where: { id: rowId } });
    if (!row) return NextResponse.json({ success: false, error: 'Row not found' }, { status: 404 });

    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const schema = JSON.parse(database.schema);
    const cellData = JSON.parse(row.cellData) as Record<string, unknown>;

    // Evaluate formula columns
    for (const col of schema) {
      if (col.type === 'formula' && col.config?.formulaExpression) {
        cellData[col.column_id] = evaluateFormula(col.config.formulaExpression, {
          rowData: cellData,
          columnSchema: schema,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        databaseId: row.databaseId,
        cellData,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases/row] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id, rowId } = await params;

  try {
    const row = await db.databaseRow.findUnique({ where: { id: rowId } });
    if (!row) return NextResponse.json({ success: false, error: 'Row not found' }, { status: 404 });

    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateRowSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });

    const schema = JSON.parse(database.schema);
    const validation = validateCellData(parsed.data.cellData, schema);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.errors?.message }, { status: 400 });
    }

    // Merge existing cellData with updated fields
    const existingData = JSON.parse(row.cellData) as Record<string, unknown>;
    const mergedData = { ...existingData, ...parsed.data.cellData };

    const updated = await db.databaseRow.update({
      where: { id: rowId },
      data: { cellData: JSON.stringify(mergedData) },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        databaseId: updated.databaseId,
        cellData: JSON.parse(updated.cellData),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases/row] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id, rowId } = await params;

  try {
    const row = await db.databaseRow.findUnique({ where: { id: rowId } });
    if (!row) return NextResponse.json({ success: false, error: 'Row not found' }, { status: 404 });

    const database = await db.noteDatabase.findUnique({
      where: { id },
      include: { parentNote: true },
    });
    if (!database || database.parentNote.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    await db.databaseRow.delete({ where: { id: rowId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[databases/row] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
