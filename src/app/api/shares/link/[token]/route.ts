// ============================================================
// MODUL 13: Share Link Access — Public access without authentication
// GET /api/shares/link/[token] — Access node via share link (no auth)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bigintToNumber } from '@/lib/bigint';

// GET /api/shares/link/[token] — Access node via share link (no auth required)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the share by token
    const share = await db.nodeShare.findUnique({
      where: { shareLinkToken: token },
    });

    if (!share) {
      return NextResponse.json({ success: false, error: 'Share link not found' }, { status: 404 });
    }

    // Check if link is expired
    if (share.shareLinkExpiry && new Date() > share.shareLinkExpiry) {
      return NextResponse.json({ success: false, error: 'Share link has expired' }, { status: 403 });
    }

    // Check if link type is public (private links would require auth — not implemented yet)
    if (share.linkType === 'private') {
      // For private links, we'd need auth — currently we only support public view
      return NextResponse.json({ success: false, error: 'This share link requires authentication' }, { status: 401 });
    }

    // Get the node data
    const node = await db.node.findUnique({
      where: { id: share.nodeId },
      include: { metadata: true, note: true },
    });

    if (!node || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'Shared content no longer exists' }, { status: 404 });
    }

    // Return read-only data based on permission level
    const responseData: Record<string, unknown> = {
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
      permissionLevel: share.permissionLevel,
      ownerId: node.ownerId,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };

    // Include content based on type
    if (node.type === 'note' && node.note) {
      responseData.content = node.note.contentJson;
    }

    // Include file metadata (download info)
    if (node.type === 'file' && node.metadata) {
      responseData.metadata = {
        mimeType: node.metadata.mimeType,
        sizeBytes: bigintToNumber(node.metadata.sizeBytes),
        fileName: node.name,
      };
    }

    // For folders, include children list (read-only)
    if (node.type === 'folder') {
      const children = await db.node.findMany({
        where: { parentId: node.id, deletedAt: null },
        select: { id: true, name: true, type: true, createdAt: true, updatedAt: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
      responseData.children = children.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));
    }

    // Mark this as read-only access for the frontend
    responseData.isReadOnly = share.permissionLevel === 'view';
    responseData.canComment = share.permissionLevel === 'comment' || share.permissionLevel === 'edit';
    responseData.canEdit = share.permissionLevel === 'edit';

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to access share link';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
