// ============================================================
// MODUL 21: Favorite Toggle API Route — Toggle isFavorite on a node
// PATCH: Set isFavorite true/false
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/nodes/[id]/favorite — Toggle favorite on a node
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify node exists and belongs to user
    const node = await db.node.findUnique({ where: { id } });
    if (!node || node.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    // Determine the new favorite state
    // If body.isFavorite is provided, use it; otherwise toggle current state
    const newFavoriteState = typeof body.isFavorite === 'boolean'
      ? body.isFavorite
      : !node.isFavorite;

    const updated = await db.node.update({
      where: { id },
      data: { isFavorite: newFavoriteState },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        isFavorite: updated.isFavorite,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to toggle favorite';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
