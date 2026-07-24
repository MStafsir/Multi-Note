// ============================================================
// MODUL 40-41: Workspace Permission Check Helpers
// Application-level RLS equivalent for workspace-scoped access
// ============================================================

import { db } from '@/lib/db';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

// Role hierarchy: owner > admin > member > viewer
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Get the workspace role for a user. Returns null if user is not a member.
 */
export async function getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    select: { role: true },
  });

  if (!membership) {
    // Also check if user is the workspace owner (ownerId on Workspace model)
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (workspace && workspace.ownerId === userId) {
      return 'owner';
    }
    return null;
  }

  return membership.role as WorkspaceRole;
}

/**
 * Check if a user has at least `minRole` in a workspace.
 * Returns { allowed, role } — role is null if user is not a member.
 */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole
): Promise<{ allowed: boolean; role: WorkspaceRole | null }> {
  const role = await getWorkspaceRole(userId, workspaceId);

  if (!role) {
    return { allowed: false, role: null };
  }

  const allowed = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
  return { allowed, role };
}

/**
 * Check if a user has any access to a workspace (member or owner).
 * 40.3 — RLS equivalent: owner_id = userId OR workspace member exists
 */
export async function checkWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const role = await getWorkspaceRole(userId, workspaceId);
  return role !== null;
}

/**
 * 40.3 — Check if a user can access a node that belongs to a workspace.
 * RLS equivalent: node.owner_id = userId OR (node.workspaceId exists AND user is workspace member)
 * Union condition: personal ownership OR workspace membership
 */
export async function checkNodeWorkspaceAccess(userId: string, nodeId: string): Promise<boolean> {
  const node = await db.node.findUnique({
    where: { id: nodeId },
    select: { ownerId: true, workspaceId: true },
  });

  if (!node) return false;

  // 1. Direct ownership check
  if (node.ownerId === userId) return true;

  // 2. Workspace membership check (if node belongs to a workspace)
  if (node.workspaceId) {
    return checkWorkspaceAccess(userId, node.workspaceId);
  }

  return false;
}

/**
 * Check if user is workspace owner (either via ownerId on Workspace or via membership with role='owner').
 */
export async function isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (workspace && workspace.ownerId === userId) return true;

  const role = await getWorkspaceRole(userId, workspaceId);
  return role === 'owner';
}

/**
 * Get all workspace IDs where the user is a member or owner.
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });

  const ownedWorkspaces = await db.workspace.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  const workspaceIds = new Set<string>();
  for (const m of memberships) workspaceIds.add(m.workspaceId);
  for (const w of ownedWorkspaces) workspaceIds.add(w.id);

  return Array.from(workspaceIds);
}
