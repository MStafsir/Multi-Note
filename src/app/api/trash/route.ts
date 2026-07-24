// ============================================================
// MODUL 17.1: Trash API Route — List all trashed nodes
// GET: Returns all soft-deleted nodes for the current user
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 17.1 — Find all nodes where ownerId = userId AND deletedAt IS NOT NULL
    const trashedNodes = await db.node.findMany({
      where: {
        ownerId: userId,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      include: {
        metadata: true,
      },
    });

    // Format nodes with proper BigInt serialization
    const nodes = trashedNodes.map((node) => {
      const metadata = node.metadata as Record<string, unknown> | null;
      return {
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        ownerId: node.ownerId,
        deletedAt: node.deletedAt,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        metadata: metadata
          ? {
              ...metadata,
              sizeBytes: bigintToNumber(metadata.sizeBytes as bigint | number | null),
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: { nodes },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch trash items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
