// ============================================================
// MODUL 40-41: Workspace Members API — List & Invite
// GET: List all members of workspace (member+ role required)
// POST: Invite new member (owner/admin only, with seat limit check)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inviteMemberSchema } from '@/lib/validators';
import { requireWorkspaceRole } from '@/lib/workspace-permissions';
import { canAddSeat } from '@/lib/workspace-quota';
import { logActivity } from '@/lib/activity-logger';
import { createNotification } from '@/lib/notification-sender';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

// GET /api/workspaces/[id]/members — List all members
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    // Any member can view members list
    const { allowed, role } = await requireWorkspaceRole(userId, workspaceId, 'viewer');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: `Access denied — requires member access, you have: ${role || 'none'}` },
        { status: 403 }
      );
    }

    const members = await db.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { invitedAt: 'asc' },
    });

    logger.info('workspace_members_listed', { workspaceId, count: members.length }, userId);

    return NextResponse.json({
      success: true,
      data: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        invitedAt: m.invitedAt.toISOString(),
        joinedAt: m.joinedAt?.toISOString() || null,
        user: m.user,
      })),
    });
  } catch (error: unknown) {
    logger.error('workspace_members_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list workspace members';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/workspaces/[id]/members — Invite a new member
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    // Only owner/admin can invite
    const { allowed, role } = await requireWorkspaceRole(userId, workspaceId, 'admin');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: `Access denied — requires admin role, you have: ${role || 'none'}` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = inviteMemberSchema.parse(body);

    // 41.2 — Check seat limit
    const seatCheck = await canAddSeat(workspaceId);
    if (!seatCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Seat limit reached (${seatCheck.currentSeats}/${seatCheck.maxSeats}). Upgrade plan to add more members.` },
        { status: 400 }
      );
    }

    // Check if user with this email exists
    const inviteeUser = await db.user.findUnique({
      where: { email: validated.email },
      select: { id: true, email: true, name: true },
    });

    if (!inviteeUser) {
      return NextResponse.json(
        { success: false, error: 'No user found with this email address' },
        { status: 404 }
      );
    }

    // Cannot invite yourself
    if (inviteeUser.id === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot invite yourself' },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMember = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: inviteeUser.id } },
    });

    if (existingMember && existingMember.joinedAt) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this workspace' },
        { status: 409 }
      );
    }

    if (existingMember && !existingMember.joinedAt) {
      return NextResponse.json(
        { success: false, error: 'User has already been invited but has not yet accepted' },
        { status: 409 }
      );
    }

    // 40.6 — Create invitation with 7-day expiry token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create membership record (joinedAt null until accepted) + invitation token
    const invitation = await db.workspaceInvitation.create({
      data: {
        workspaceId,
        email: validated.email,
        role: validated.role,
        token,
        invitedBy: userId,
        expiresAt,
      },
    });

    // Also create WorkspaceMember record (joinedAt = null until invitation is accepted)
    // This ensures the member appears in the list as "pending"
    await db.workspaceMember.create({
      data: {
        workspaceId,
        userId: inviteeUser.id,
        role: validated.role,
        invitedAt: new Date(),
        joinedAt: null, // pending invitation
      },
    });

    // Send notification via createNotification() — type 'share_received'
    await createNotification({
      recipientId: inviteeUser.id,
      type: 'share_received',
      payload: {
        workspaceId,
        workspaceName: (await db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }))?.name,
        role: validated.role,
        invitedByUserId: userId,
        invitationToken: token,
      },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'share',
      metadata: {
        type: 'workspace_invite',
        workspaceId,
        invitedUserId: inviteeUser.id,
        invitedEmail: validated.email,
        role: validated.role,
        token,
      },
    });

    logger.info('workspace_member_invited', {
      workspaceId,
      invitedUserId: inviteeUser.id,
      role: validated.role,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        invitationId: invitation.id,
        email: validated.email,
        role: validated.role,
        token,
        expiresAt: expiresAt.toISOString(),
        invitedUser: {
          id: inviteeUser.id,
          email: inviteeUser.email,
          name: inviteeUser.name,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('workspace_member_invite_failed', {}, error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to invite member';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
