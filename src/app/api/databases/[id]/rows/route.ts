// ============================================================
// MODUL 31+32: Database Rows API — CRUD with filter/sort/formula/rollup
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createRowSchema, updateRowSchema } from '@/lib/validators';
import { evaluateFormula, validateCellData } from '@/lib/formula-engine';

// Helper: evaluate filter group server-side
function evaluateFilterGroup(
  filterGroup: { type: 'and' | 'or'; conditions: Array<{ columnId: string; operator: string; value?: unknown }> },
  cellData: Record<string, unknown>,
  columns: Array<{ column_id: string; name: string; type: string; config?: Record<string, unknown> }>
): boolean {
  const results = filterGroup.conditions.map(cond => {
    const value = cellData[cond.columnId];
    switch (cond.operator) {
      case 'equals': return value === cond.value;
      case 'not_equals': return value !== cond.value;
      case 'contains': return typeof value === 'string' && value.includes(String(cond.value ?? ''));
      case 'not_contains': return typeof value === 'string' && !value.includes(String(cond.value ?? ''));
      case 'is_empty': return value === null || value === undefined || value === '';
      case 'is_not_empty': return value !== null && value !== undefined && value !== '';
      case 'greater_than': return Number(value) > Number(cond.value);
      case 'less_than': return Number(value) < Number(cond.value);
      default: return true;
    }
  });

  return filterGroup.type === 'and' ? results.every(Boolean) : results.some(Boolean);
}

// Helper: apply sorts
function applySorts(
  rows: Array<{ id: string; cellData: Record<string, unknown>; createdAt: Date; updatedAt: Date }>,
  sorts: Array<{ columnId: string; direction: 'asc' | 'desc' }>
): Array<{ id: string; cellData: Record<string, unknown>; createdAt: Date; updatedAt: Date }> {
  return rows.sort((a, b) => {
    for (const sort of sorts) {
      const aVal = a.cellData[sort.columnId] ?? '';
      const bVal = b.cellData[sort.columnId] ?? '';
      const cmp = String(aVal) < String(bVal) ? -1 : String(aVal) > String(bVal) ? 1 : 0;
      if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

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

    if (!database) return NextResponse.json({ success: false, error: 'Database not found' }, { status: 404 });
    if (database.parentNote.ownerId !== userId) return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });

    const schema = JSON.parse(database.schema);
    const url = request.nextUrl.searchParams;

    // Load view config if viewId specified
    const viewId = url.get('viewId');
    let filters: Record<string, unknown> | undefined;
    let sorts: Array<{ columnId: string; direction: string }> | undefined;

    if (viewId) {
      const view = await db.databaseView.findUnique({ where: { id: viewId } });
      if (view) {
        const viewConfig = JSON.parse(view.config);
        filters = viewConfig.filters;
        sorts = viewConfig.sorts;
      }
    }

    // Override with query params if provided
    const filterParam = url.get('filters');
    const sortParam = url.get('sorts');
    if (filterParam) filters = JSON.parse(filterParam);
    if (sortParam) sorts = JSON.parse(sortParam);

    const page = parseInt(url.get('page') || '1');
    const pageSize = parseInt(url.get('pageSize') || '50');

    // Fetch all rows
    const allRows = await db.databaseRow.findMany({ where: { databaseId: id } });

    // Parse cell data and apply computed columns
    const processedRows = allRows.map(row => {
      const cellData = JSON.parse(row.cellData) as Record<string, unknown>;

      // Evaluate formula columns
      for (const col of schema) {
        if (col.type === 'formula' && col.config?.formulaExpression) {
          const result = evaluateFormula(col.config.formulaExpression, {
            rowData: cellData,
            columnSchema: schema,
          });
          cellData[col.column_id] = result;
        }
      }

      return { id: row.id, cellData, createdAt: row.createdAt, updatedAt: row.updatedAt };
    });

    // Apply filters
    let filteredRows = processedRows;
    if (filters) {
      filteredRows = processedRows.filter(row =>
        evaluateFilterGroup(filters as { type: 'and' | 'or'; conditions: Array<{ columnId: string; operator: string; value?: unknown }> }, row.cellData, schema)
      );
    }

    // Apply sorts
    if (sorts) {
      filteredRows = applySorts(filteredRows, sorts as Array<{ columnId: string; direction: 'asc' | 'desc' }>);
    }

    // Paginate
    const total = filteredRows.length;
    const paginated = filteredRows.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      success: true,
      data: {
        rows: paginated.map(r => ({
          id: r.id,
          databaseId: id,
          cellData: r.cellData,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('[databases/rows] GET error:', error);
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

    if (!database) return NextResponse.json({ success: false, error: 'Database not found' }, { status: 404 });
    if (database.parentNote.ownerId !== userId) return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });

    const body = await request.json();
    const parsed = createRowSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });

    const schema = JSON.parse(database.schema);

    // Dynamic Zod validation (31.7)
    const validation = validateCellData(parsed.data.cellData, schema);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.errors?.message }, { status: 400 });
    }

    // Add auto-computed fields (created_time, created_by)
    const cellData = { ...parsed.data.cellData };
    for (const col of schema) {
      if (col.type === 'created_time') cellData[col.column_id] = new Date().toISOString();
      if (col.type === 'created_by') cellData[col.column_id] = userId;
    }

    const row = await db.databaseRow.create({
      data: {
        databaseId: id,
        cellData: JSON.stringify(cellData),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        databaseId: row.databaseId,
        cellData: JSON.parse(row.cellData),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[databases/rows] POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
