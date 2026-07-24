// ============================================================
// MODUL 21: Tag CRUD API Routes — Create & List Tags
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// --- Zod Validators ---
const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100, 'Tag name too long'),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').default('#6B7280'),
});

// GET /api/tags — List all tags for current user
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tags = await db.tag.findMany({
      where: { ownerId: userId },
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        colorHex: tag.colorHex,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tags';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/tags — Create a new tag
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createTagSchema.parse(body);

    // Check for duplicate tag name for this user
    const existing = await db.tag.findFirst({
      where: { ownerId: userId, name: validated.name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Tag with this name already exists' },
        { status: 409 }
      );
    }

    const tag = await db.tag.create({
      data: {
        ownerId: userId,
        name: validated.name,
        colorHex: validated.colorHex,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: tag.id,
        name: tag.name,
        colorHex: tag.colorHex,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create tag';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
