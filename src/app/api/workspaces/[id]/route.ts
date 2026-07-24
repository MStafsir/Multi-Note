// ============================================================
// MODUL 40-41: Workspace Detail API — GET, PATCH, DELETE
// GET: Get workspace info (member/owner access required)
// PATCH: Update workspace name/planTier (owner/admin only)
// DELETE: Delete workspace (owner only)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateWorkspaceSchema } from '@/lib/validators';
import { getWorkspaceRole, requireWorkspaceRole } from '@/lib/workspace-permissions';
import { canDowngradePlan } from '@/lib/workspace-quota';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import type { WorkspaceRole } from '@/lib/workspace-permissions';

// GET /api/workspaces/[id] — Get workspace details
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

    // Check access — any member can view
    const role = await getWorkspaceRole(userId, workspaceId);
    if (!role) {
      return NextResponse.json({ success: false, error: 'Access denied — not a workspace member' }, { status: 403 });
    }

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        },
        _count: { select: { nodes: true } },
      },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    logger.info('workspace_detail_viewed', { workspaceId }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        planTier: workspace.planTier,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
        nodeCount: workspace._count.nodes,
        members: workspace.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          invitedAt: m.invitedAt.toISOString(),
          joinedAt: m.joinedAt?.toISOString() || null,
          user: m.user,
        })),
      },
    });
  } catch (error: unknown) {
    logger.error('workspace_detail_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to get workspace details';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/workspaces/[id] — Update workspace name/planTier (owner/admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    // Require admin role for workspace updates
    const { allowed, role } = await requireWorkspaceRole(userId, workspaceId, 'admin');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: `Access denied — requires admin role, you have: ${role || 'none'}` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateWorkspaceSchema.parse(body);

    // If changing planTier (downgrade), check downgrade guard (41.3)
    if (validated.planTier) {
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { planTier: true },
      });

      if (workspace && validated.planTier !== workspace.planTier) {
        const downgradeCheck = await canDowngradePlan(workspaceId, validated.planTier);
        if (!downgradeCheck.allowed) {
          return NextResponse.json(
            { success: false, error: `Cannot downgrade plan: ${downgradeCheck.blockers.join('; ')}` },
            { status: 400 }
          );
        }
      }
    }

    // Update workspace
    const updateData: Record<string, unknown> = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.planTier) updateData.planTier = validated.planTier;

    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: updateData,
    });

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'edit',
      metadata: {
        type: 'workspace_update',
        workspaceId,
        changes: validated,
      },
    });

    logger.info('workspace_updated', { workspaceId, changes: validated }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        planTier: workspace.planTier,
        updatedAt: workspace.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('workspace_update_failed', {}, error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to update workspace';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] — Delete workspace (owner only, 41.5 ownership transfer check)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    // Only owner can delete workspace
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.ownerId !== userId) {
      // Check if they have owner role via membership
      const membershipRole = await getWorkspaceRole(userId, workspaceId);
      if (membershipRole !== 'owner') {
        return NextResponse.json(
          { success: false, error: 'Only workspace owner can delete a workspace' },
          { status: 403 }
        );
      }
    }

    // Delete workspace (cascade deletes members, invitations, nodes)
    await db.workspace.delete({
      where: { id: workspaceId },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'delete',
      metadata: { type: 'workspace_delete', workspaceId },
    });

    logger.info('workspace_deleted', { workspaceId }, userId);

    return NextResponse.json({ success: true, data: { workspaceId } });
  } catch (error: unknown) {
    logger.error('workspace_delete_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to delete workspace';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
