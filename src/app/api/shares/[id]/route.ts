// ============================================================
// MODUL 13: Share API — DELETE (remove share) + PATCH (update permission)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateShareSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess, getAllDescendants } from '@/lib/permissions';

// DELETE /api/shares/[id] — Remove a share (owner only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the share
    const share = await db.nodeShare.findUnique({
      where: { id },
    });

    if (!share) {
      return NextResponse.json({ success: false, error: 'Share not found' }, { status: 404 });
    }

    // Verify the requesting user has edit access to the node
    const node = await db.node.findUnique({
      where: { id: share.nodeId },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const accessResult = await checkNodeAccess(session.user.id, share.nodeId, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Not authorized to remove this share' }, { status: 403 });
    }

    // If this is a folder share, also remove cascaded child shares
    let cascadedRemoved = 0;
    if (node.type === 'folder') {
      const descendantIds = await getAllDescendants(share.nodeId, session.user.id, node.workspaceId);

      const childShares = await db.nodeShare.findMany({
        where: {
          nodeId: { in: descendantIds },
          sharedWithUserId: share.sharedWithUserId,
          // Only remove cascaded shares (not ones with their own link tokens)
          shareLinkToken: null,
        },
      });

      if (childShares.length > 0) {
        await db.nodeShare.deleteMany({
          where: {
            id: { in: childShares.map(s => s.id) },
          },
        });
        cascadedRemoved = childShares.length;
      }
    }

    // Delete the share itself
    await db.nodeShare.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        actorId: session.user.id,
        nodeId: share.nodeId,
        actionType: 'share',
        metadata: JSON.stringify({
          action: 'remove',
          shareId: id,
          sharedWithUserId: share.sharedWithUserId,
          cascadedRemoved,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { removed: true, cascadedRemoved },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove share';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/shares/[id] — Update share permission level (owner only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateShareSchema.parse(body);

    // Find the share
    const share = await db.nodeShare.findUnique({
      where: { id },
    });

    if (!share) {
      return NextResponse.json({ success: false, error: 'Share not found' }, { status: 404 });
    }

    // Verify the requesting user has edit access to the node
    const node = await db.node.findUnique({
      where: { id: share.nodeId },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const accessResult = await checkNodeAccess(session.user.id, share.nodeId, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Not authorized to update this share' }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validated.permissionLevel) {
      updateData.permissionLevel = validated.permissionLevel;

      // If this is a folder share, also update cascaded child shares
      if (node.type === 'folder') {
        const descendantIds = await getAllDescendants(share.nodeId, session.user.id, node.workspaceId);

        await db.nodeShare.updateMany({
          where: {
            nodeId: { in: descendantIds },
            sharedWithUserId: share.sharedWithUserId,
            shareLinkToken: null,
          },
          data: {
            permissionLevel: validated.permissionLevel,
          },
        });
      }
    }

    if (validated.shareLinkExpiry !== undefined) {
      updateData.shareLinkExpiry = validated.shareLinkExpiry
        ? new Date(validated.shareLinkExpiry)
        : null;
    }

    if (validated.linkType) {
      updateData.linkType = validated.linkType;
    }

    // Update the share
    const updated = await db.nodeShare.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        nodeId: updated.nodeId,
        sharedWithUserId: updated.sharedWithUserId,
        permissionLevel: updated.permissionLevel,
        shareLinkToken: updated.shareLinkToken,
        shareLinkExpiry: updated.shareLinkExpiry?.toISOString() || null,
        linkType: updated.linkType,
        createdAt: updated.createdAt.toISOString(),
        shareLinkUrl: updated.shareLinkToken ? `/share/${updated.shareLinkToken}` : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update share';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
