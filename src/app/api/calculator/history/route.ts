// ============================================================
// API Route — Calculator History (Modul 11)
// GET: list calculation history for current user
// POST: save a calculation to permanent history
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/calculator/history — list user's calculation history
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const history = await db.calculationHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to 100 items
    });

    return NextResponse.json({
      success: true,
      data: history.map((item) => ({
        id: item.id,
        expression: item.expression,
        result: item.result,
        mode: item.mode,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[calculator/history] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}

// POST /api/calculator/history — save a calculation to permanent history
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { expression, result, mode } = body;

    if (!expression || !result || !mode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: expression, result, mode' },
        { status: 400 }
      );
    }

    if (!['basic', 'scientific', 'unit'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be: basic, scientific, or unit' },
        { status: 400 }
      );
    }

    const entry = await db.calculationHistory.create({
      data: {
        userId,
        expression,
        result,
        mode,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: entry.id,
        expression: entry.expression,
        result: entry.result,
        mode: entry.mode,
        createdAt: entry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[calculator/history] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save history' }, { status: 500 });
  }
}
