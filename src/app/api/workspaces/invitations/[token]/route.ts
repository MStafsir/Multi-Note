// ============================================================
// MODUL 40.6: Workspace Invitation API — GET (view), POST (accept), PATCH (decline)
// GET: Get invitation details by token (public — no auth required)
// POST: Accept invitation — authenticated user with matching email
// PATCH: Decline invitation — sets declinedAt
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// GET /api/workspaces/invitations/[token] — View invitation details (public)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await db.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true, planTier: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Check if already declined
    if (invitation.declinedAt) {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been declined' },
        { status: 400 }
      );
    }

    // Get inviter info
    const inviter = await db.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { id: true, name: true, email: true },
    });

    logger.info('invitation_viewed', { token, workspaceId: invitation.workspaceId });

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace.name,
        workspacePlanTier: invitation.workspace.planTier,
        email: invitation.email,
        role: invitation.role,
        invitedBy: inviter,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('invitation_view_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to view invitation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/workspaces/invitations/[token] — Accept invitation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized — must be logged in to accept invitation' }, { status: 401 });
    }

    const { token } = await params;

    const invitation = await db.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true, planTier: true, ownerId: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Check if already declined
    if (invitation.declinedAt) {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been declined' },
        { status: 400 }
      );
    }

    // Verify authenticated user has matching email
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user || user.email !== invitation.email) {
      return NextResponse.json(
        { success: false, error: 'This invitation was sent to a different email address. Please log in with the correct email.' },
        { status: 403 }
      );
    }

    // Update WorkspaceMember record: set joinedAt
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    });

    if (member) {
      // Update existing pending membership
      await db.workspaceMember.update({
        where: { id: member.id },
        data: {
          role: invitation.role, // Use the role from invitation
          joinedAt: new Date(),
        },
      });
    } else {
      // Create new membership (edge case: member record was deleted)
      await db.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          invitedAt: invitation.createdAt,
          joinedAt: new Date(),
        },
      });
    }

    // Set invitation acceptedAt
    await db.workspaceInvitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'create',
      metadata: {
        type: 'invitation_accepted',
        workspaceId: invitation.workspaceId,
        role: invitation.role,
        token,
      },
    });

    logger.info('invitation_accepted', {
      workspaceId: invitation.workspaceId,
      userId,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace.name,
        role: invitation.role,
      },
    });
  } catch (error: unknown) {
    logger.error('invitation_accept_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to accept invitation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/workspaces/invitations/[token] — Decline invitation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized — must be logged in to decline invitation' }, { status: 401 });
    }

    const { token } = await params;

    const invitation = await db.workspaceInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Check if already declined
    if (invitation.declinedAt) {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been declined' },
        { status: 400 }
      );
    }

    // Verify authenticated user has matching email
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user || user.email !== invitation.email) {
      return NextResponse.json(
        { success: false, error: 'This invitation was sent to a different email address.' },
        { status: 403 }
      );
    }

    // Set declinedAt on the invitation
    await db.workspaceInvitation.update({
      where: { token },
      data: { declinedAt: new Date() },
    });

    // Remove the pending WorkspaceMember record
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    });

    if (member && !member.joinedAt) {
      await db.workspaceMember.delete({
        where: { id: member.id },
      });
    }

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'edit',
      metadata: {
        type: 'invitation_declined',
        workspaceId: invitation.workspaceId,
        token,
      },
    });

    logger.info('invitation_declined', {
      workspaceId: invitation.workspaceId,
      userId,
    }, userId);

    return NextResponse.json({ success: true, data: { declined: true } });
  } catch (error: unknown) {
    logger.error('invitation_decline_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to decline invitation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
