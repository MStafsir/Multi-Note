// ============================================================
// MODUL 41.5: Workspace Ownership Transfer API
// POST: Transfer ownership from current owner to another admin
// Only current owner can initiate; target must be an existing admin member
// After transfer: old owner becomes 'admin', new owner becomes 'owner'
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transferOwnershipSchema } from '@/lib/validators';
import { getWorkspaceRole } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// POST /api/workspaces/[id]/transfer — Transfer ownership
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

    // Only current owner can initiate transfer
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, name: true },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    // Check if current user is the owner
    const currentOwnerRole = await getWorkspaceRole(userId, workspaceId);
    if (currentOwnerRole !== 'owner') {
      // Also check workspace.ownerId directly
      if (workspace.ownerId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Only the workspace owner can transfer ownership' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validated = transferOwnershipSchema.parse(body);

    // Get target member — must be an existing admin
    const targetMember = await db.workspaceMember.findUnique({
      where: { id: validated.targetMemberId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json(
        { success: false, error: 'Target member not found in this workspace' },
        { status: 404 }
      );
    }

    // Target must be an existing admin member
    if (targetMember.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Ownership can only be transferred to an admin member. Promote the member to admin first.' },
        { status: 400 }
      );
    }

    // Cannot transfer to yourself
    if (targetMember.userId === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot transfer ownership to yourself' },
        { status: 400 }
      );
    }

    // Target must have joinedAt (fully accepted member, not pending invitation)
    if (!targetMember.joinedAt) {
      return NextResponse.json(
        { success: false, error: 'Target member has not yet accepted their invitation to the workspace' },
        { status: 400 }
      );
    }

    // Perform ownership transfer
    // 1. Update workspace ownerId
    // 2. Change old owner's role to 'admin'
    // 3. Change new owner's role to 'owner'

    const oldOwnerId = userId;
    const newOwnerId = targetMember.userId;

    // Update workspace ownerId
    await db.workspace.update({
      where: { id: workspaceId },
      data: { ownerId: newOwnerId },
    });

    // Change old owner's membership role to 'admin'
    const oldOwnerMembership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: oldOwnerId } },
    });

    if (oldOwnerMembership) {
      await db.workspaceMember.update({
        where: { id: oldOwnerMembership.id },
        data: { role: 'admin' },
      });
    }

    // Change new owner's membership role to 'owner'
    await db.workspaceMember.update({
      where: { id: targetMember.id },
      data: { role: 'owner' },
    });

    // 41.5 — Log activity: actionType='edit' with metadata {type: 'ownership_transfer', from, to}
    await logActivity({
      actorId: userId,
      actionType: 'edit',
      metadata: {
        type: 'ownership_transfer',
        workspaceId,
        from: oldOwnerId,
        to: newOwnerId,
      },
    });

    logger.info('ownership_transferred', {
      workspaceId,
      from: oldOwnerId,
      to: newOwnerId,
    }, userId);

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        previousOwnerId: oldOwnerId,
        newOwnerId: newOwnerId,
        previousOwnerRole: 'admin',
        newOwnerRole: 'owner',
      },
    });
  } catch (error: unknown) {
    logger.error('ownership_transfer_failed', {}, error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to transfer ownership';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
