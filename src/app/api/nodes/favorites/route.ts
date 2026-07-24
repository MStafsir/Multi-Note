// ============================================================
// MODUL 21: Favorite List API Route — List all favorite nodes for user
// GET: List favorite nodes with metadata, note content, and tags
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';

// GET /api/nodes/favorites — List all favorite nodes for current user
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const nodes = await db.node.findMany({
      where: {
        ownerId: userId,
        isFavorite: true,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        metadata: true,
        note: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: nodes.map(node => ({
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        isFavorite: node.isFavorite,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        metadata: node.metadata
          ? { ...node.metadata as Record<string, unknown>, sizeBytes: bigintToNumber((node.metadata as Record<string, unknown>).sizeBytes as bigint | number | null) }
          : null,
        content: node.note ? { nodeId: node.note.nodeId, contentJson: node.note.contentJson } : null,
        tags: node.tags.map(nt => ({
          tagId: nt.tagId,
          nodeId: nt.nodeId,
          tag: {
            id: nt.tag.id,
            name: nt.tag.name,
            colorHex: nt.tag.colorHex,
          },
        })),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch favorites';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
