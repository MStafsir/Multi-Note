// ============================================================
// MODUL 41: Workspace Member Role API — PATCH (change role), DELETE (remove)
// PATCH: Change member role (owner/admin only, cannot change owner's role)
//        41.4 — Role-change audit: log activity with metadata including old_role, new_role
// DELETE: Remove member (owner/admin, or member removing themselves)
//         41.5 — Owner cannot leave unless ownership transferred first
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateMemberRoleSchema } from '@/lib/validators';
import { getWorkspaceRole, requireWorkspaceRole } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// PATCH /api/workspaces/[id]/members/[memberId] — Change member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId, memberId } = await params;

    // Only owner/admin can change roles
    const { allowed, role: actorRole } = await requireWorkspaceRole(userId, workspaceId, 'admin');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: `Access denied — requires admin role, you have: ${actorRole || 'none'}` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateMemberRoleSchema.parse(body);

    // Get the target member
    const targetMember = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json({ success: false, error: 'Member not found in this workspace' }, { status: 404 });
    }

    // Cannot change the owner's role (41.4)
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Cannot change the owner\'s role. Transfer ownership first.' },
        { status: 403 }
      );
    }

    // Cannot downgrade owner role — already blocked above
    // Cannot set someone to 'owner' role via this endpoint (must use transfer endpoint)
    if (validated.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Cannot assign owner role via this endpoint. Use ownership transfer instead.' },
        { status: 403 }
      );
    }

    const oldRole = targetMember.role;
    const newRole = validated.role;

    // Update the member role
    const updatedMember = await db.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // 41.4 — Role-change audit: log activity with metadata including old_role, new_role
    await logActivity({
      actorId: userId,
      actionType: 'edit',
      metadata: {
        type: 'role_change',
        workspaceId,
        memberId,
        targetUserId: targetMember.userId,
        old_role: oldRole,
        new_role: newRole,
      },
    });

    logger.info('member_role_changed', {
      workspaceId,
      memberId,
      oldRole,
      newRole,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        role: updatedMember.role,
        user: updatedMember.user,
      },
    });
  } catch (error: unknown) {
    logger.error('member_role_change_failed', {}, error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to change member role';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/members/[memberId] — Remove member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId, memberId } = await params;

    // Get the target member
    const targetMember = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json({ success: false, error: 'Member not found in this workspace' }, { status: 404 });
    }

    // 41.5 — If owner tries to leave, BLOCK unless ownership transferred first
    if (targetMember.role === 'owner' && targetMember.userId === userId) {
      return NextResponse.json(
        { success: false, error: 'Owner must transfer ownership before leaving workspace' },
        { status: 403 }
      );
    }

    // Cannot remove the workspace owner
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Cannot remove the workspace owner. Transfer ownership first.' },
        { status: 403 }
      );
    }

    // Permission check:
    // - Owner/admin can remove any member
    // - Member can remove themselves (leave workspace)
    const isSelfRemoval = targetMember.userId === userId;
    if (!isSelfRemoval) {
      const { allowed, role: actorRole } = await requireWorkspaceRole(userId, workspaceId, 'admin');
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: `Access denied — requires admin role to remove others, you have: ${actorRole || 'none'}` },
          { status: 403 }
        );
      }
    }

    // Remove the member
    await db.workspaceMember.delete({
      where: { id: memberId },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'delete',
      metadata: {
        type: isSelfRemoval ? 'member_leave' : 'member_remove',
        workspaceId,
        removedUserId: targetMember.userId,
        removedRole: targetMember.role,
      },
    });

    logger.info('member_removed', {
      workspaceId,
      memberId,
      removedUserId: targetMember.userId,
      isSelfRemoval,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        removedMemberId: memberId,
        removedUserId: targetMember.userId,
      },
    });
  } catch (error: unknown) {
    logger.error('member_remove_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
