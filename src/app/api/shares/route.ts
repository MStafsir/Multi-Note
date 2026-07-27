// ============================================================
// MODUL 13: Share API — POST (create share) + GET (list shares)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createShareSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess, getAllDescendants } from '@/lib/permissions';
import { bigintToNumber } from '@/lib/bigint';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '@/lib/activity-logger';
import { createNotification } from '@/lib/notification-sender';

// POST /api/shares — Create a share (user share or public link)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createShareSchema.parse(body);

    // Verify the node exists and the user is the owner
    const node = await db.node.findUnique({
      where: { id: validated.nodeId },
      include: { metadata: true, note: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const accessResult = await checkNodeAccess(session.user.id, validated.nodeId, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Not authorized — you need edit permission to share this node' }, { status: 403 });
    }

    // Validate sharedWithUserId if provided
    if (validated.sharedWithUserId) {
      const targetUser = await db.user.findUnique({
        where: { id: validated.sharedWithUserId },
      });
      if (!targetUser) {
        return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 });
      }

      // Cannot share with yourself
      if (validated.sharedWithUserId === session.user.id) {
        return NextResponse.json({ success: false, error: 'Cannot share with yourself' }, { status: 400 });
      }
    }

    // Calculate expiry if specified
    const shareLinkExpiry = validated.expiryHours
      ? new Date(Date.now() + validated.expiryHours * 3600000)
      : null;

    // Generate share link token if requested
    const shareLinkToken = validated.generateLink ? uuidv4() : null;
    const linkType = validated.generateLink
      ? (validated.linkType || 'public')
      : null;

    // Create the share record
    const share = await db.nodeShare.create({
      data: {
        nodeId: validated.nodeId,
        sharedWithUserId: validated.sharedWithUserId || null,
        permissionLevel: validated.permissionLevel,
        shareLinkToken,
        shareLinkExpiry,
        linkType,
      },
    });

    // Cascading: if sharing a folder, create share records for all descendants
    // with the same permission level and same user (but NOT share link tokens — only the folder has the link)
    let cascadedCount = 0;
    if (node.type === 'folder') {
      const descendantIds = await getAllDescendants(validated.nodeId, session.user.id, node.workspaceId);

      for (const descendantId of descendantIds) {
        // Skip if a share already exists for this user/node combination
        const existing = await db.nodeShare.findFirst({
          where: {
            nodeId: descendantId,
            sharedWithUserId: validated.sharedWithUserId || null,
          },
        });

        if (!existing) {
          await db.nodeShare.create({
            data: {
              nodeId: descendantId,
              sharedWithUserId: validated.sharedWithUserId || null,
              permissionLevel: validated.permissionLevel,
              // Cascade shares don't get their own link tokens
              shareLinkToken: null,
              shareLinkExpiry: null,
              linkType: null,
            },
          });
          cascadedCount++;
        } else {
          // Update permission if existing share has lower level
          const currentLevel = existing.permissionLevel;
          const hierarchy = { view: 1, comment: 2, edit: 3 };
          if (hierarchy[validated.permissionLevel as keyof typeof hierarchy] > hierarchy[currentLevel as keyof typeof hierarchy]) {
            await db.nodeShare.update({
              where: { id: existing.id },
              data: { permissionLevel: validated.permissionLevel },
            });
          }
        }
      }
    }

    // 19 — Log activity using shared logger
    await logActivity({
      actorId: session.user.id,
      nodeId: validated.nodeId,
      actionType: 'share',
      metadata: {
        sharedWithUserId: validated.sharedWithUserId,
        permissionLevel: validated.permissionLevel,
        generateLink: validated.generateLink,
        cascadedCount,
      },
    });

    // 20 — Create notification for the shared-with user
    if (validated.sharedWithUserId) {
      await createNotification({
        recipientId: validated.sharedWithUserId,
        type: 'share_received',
        payload: {
          nodeId: validated.nodeId,
          nodeName: node.name,
          permissionLevel: validated.permissionLevel,
          sharedByUserId: session.user.id,
          sharedByName: session.user.name,
        },
      });
    }

    // Build response
    const responseData: Record<string, unknown> = {
      id: share.id,
      nodeId: share.nodeId,
      sharedWithUserId: share.sharedWithUserId,
      permissionLevel: share.permissionLevel,
      shareLinkToken: share.shareLinkToken,
      shareLinkExpiry: share.shareLinkExpiry?.toISOString() || null,
      linkType: share.linkType,
      createdAt: share.createdAt.toISOString(),
      cascadedCount,
    };

    // Include share link URL if generated
    if (share.shareLinkToken) {
      responseData.shareLinkUrl = `/share/${share.shareLinkToken}`;
    }

    // Include target user info if shared with a user
    if (validated.sharedWithUserId) {
      const targetUser = await db.user.findUnique({
        where: { id: validated.sharedWithUserId },
        select: { id: true, email: true, name: true },
      });
      responseData.sharedWithEmail = targetUser?.email;
      responseData.sharedWithName = targetUser?.name;
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create share';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// GET /api/shares?nodeId=xxx — List shares for a node
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');

    if (!nodeId) {
      return NextResponse.json({ success: false, error: 'nodeId parameter required' }, { status: 400 });
    }

    // Verify the node exists and the user is the owner
    const node = await db.node.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const accessResult = await checkNodeAccess(session.user.id, nodeId, 'edit');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Not authorized — you need edit permission to view shares' }, { status: 403 });
    }

    // Get all shares for this node
    const shares = await db.nodeShare.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with user info
    const enrichedShares = await Promise.all(
      shares.map(async (share) => {
        let sharedWithEmail: string | null = null;
        let sharedWithName: string | null = null;

        if (share.sharedWithUserId) {
          const user = await db.user.findUnique({
            where: { id: share.sharedWithUserId },
            select: { email: true, name: true },
          });
          sharedWithEmail = user?.email || null;
          sharedWithName = user?.name || null;
        }

        return {
          id: share.id,
          nodeId: share.nodeId,
          sharedWithUserId: share.sharedWithUserId,
          permissionLevel: share.permissionLevel,
          shareLinkToken: share.shareLinkToken,
          shareLinkExpiry: share.shareLinkExpiry?.toISOString() || null,
          linkType: share.linkType,
          createdAt: share.createdAt.toISOString(),
          sharedWithEmail,
          sharedWithName,
          shareLinkUrl: share.shareLinkToken ? `/share/${share.shareLinkToken}` : null,
          isExpired: share.shareLinkExpiry ? new Date() > share.shareLinkExpiry : false,
        };
      })
    );

    return NextResponse.json({ success: true, data: enrichedShares });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list shares';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
