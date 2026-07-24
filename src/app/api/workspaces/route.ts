// ============================================================
// MODUL 40-41: Workspace CRUD API — List & Create
// GET: List all workspaces where user is owner or member
// POST: Create new workspace (user becomes owner with plan_tier='free')
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createWorkspaceSchema } from '@/lib/validators';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// GET /api/workspaces — List all workspaces for current user
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspaces where user is owner or member
    const ownedWorkspaces = await db.workspace.findMany({
      where: { ownerId: userId },
      include: {
        members: {
          where: { joinedAt: { not: null } },
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        },
        _count: { select: { nodes: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const memberWorkspaces = await db.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
        ownerId: { not: userId }, // exclude owned (already fetched)
      },
      include: {
        members: {
          where: { joinedAt: { not: null } },
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        },
        _count: { select: { nodes: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const allWorkspaces = [...ownedWorkspaces, ...memberWorkspaces];

    // Format response with user's role in each workspace
    const formatted = allWorkspaces.map((ws) => {
      const membership = ws.members.find((m) => m.userId === userId);
      const role = ws.ownerId === userId ? 'owner' : (membership?.role || 'viewer');

      return {
        id: ws.id,
        name: ws.name,
        ownerId: ws.ownerId,
        planTier: ws.planTier,
        role,
        createdAt: ws.createdAt.toISOString(),
        updatedAt: ws.updatedAt.toISOString(),
        memberCount: ws.members.length,
        nodeCount: ws._count.nodes,
        members: ws.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt?.toISOString() || null,
          user: m.user,
        })),
      };
    });

    logger.info('workspaces_listed', { count: formatted.length }, userId);

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: unknown) {
    logger.error('workspaces_list_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Failed to list workspaces';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/workspaces — Create a new workspace
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createWorkspaceSchema.parse(body);

    // Create workspace with user as owner and plan_tier='free'
    const workspace = await db.workspace.create({
      data: {
        name: validated.name,
        ownerId: userId,
        planTier: 'free',
        members: {
          create: {
            userId,
            role: 'owner',
            invitedAt: new Date(),
            joinedAt: new Date(), // owner auto-joins
          },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        },
      },
    });

    // Log activity
    await logActivity({
      actorId: userId,
      actionType: 'create',
      metadata: { type: 'workspace', name: validated.name, workspaceId: workspace.id },
    });

    logger.info('workspace_created', { workspaceId: workspace.id, name: validated.name }, userId);

    return NextResponse.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        planTier: workspace.planTier,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
        members: workspace.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt?.toISOString() || null,
          user: m.user,
        })),
      },
    });
  } catch (error: unknown) {
    logger.error('workspace_create_failed', {}, error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to create workspace';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
