// ============================================================
// MODUL 21: Tag CRUD API Routes — Update & Delete Tag by ID
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// --- Zod Validators ---
const updateTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100, 'Tag name too long').optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
});

// PATCH /api/tags/[id] — Update tag name/colorHex
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
    const validated = updateTagSchema.parse(body);

    // Verify tag exists and belongs to user
    const tag = await db.tag.findUnique({ where: { id } });
    if (!tag || tag.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Tag not found or does not belong to you' }, { status: 404 });
    }

    // Check for duplicate name if name is being updated
    if (validated.name && validated.name !== tag.name) {
      const duplicate = await db.tag.findFirst({
        where: { ownerId: userId, name: validated.name },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Tag with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updated = await db.tag.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        colorHex: updated.colorHex,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update tag';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// DELETE /api/tags/[id] — Delete tag (cascade deletes NodeTag entries)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify tag exists and belongs to user
    const tag = await db.tag.findUnique({ where: { id } });
    if (!tag || tag.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Tag not found or does not belong to you' }, { status: 404 });
    }

    // Delete tag — NodeTag entries are cascade deleted via onDelete:Cascade in schema
    await db.tag.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, name: tag.name },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete tag';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
