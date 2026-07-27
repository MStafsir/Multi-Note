// ============================================================
// MODUL 49.12a: Workspace Scope Helper
// Shared utility for building workspace-aware WHERE clauses
// so personal-scope routes can access both personal nodes
// and workspace nodes the user belongs to.
// ============================================================

import { db } from '@/lib/db';

/**
 * Get all workspace IDs the user belongs to (as member or owner).
 * Returns an array of workspaceId strings.
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

/**
 * Build the standard workspace-scoped OR WHERE clause.
 * Pattern: personal workspace nodes OR workspace nodes the user belongs to.
 *
 * Usage:
 *   const { workspaceScopeFilter, workspaceIds } = await getWorkspaceScopeFilter(userId);
 *   db.node.findMany({ where: { ...workspaceScopeFilter, deletedAt: null } });
 *
 * The returned workspaceScopeFilter is:
 *   { OR: [{ ownerId: userId, workspaceId: null }, { workspaceId: { in: workspaceIds } }] }
 */
export async function getWorkspaceScopeFilter(userId: string): Promise<{
  workspaceScopeFilter: { OR: Array<Record<string, unknown>> };
  workspaceIds: string[];
}> {
  const workspaceIds = await getUserWorkspaceIds(userId);

  const workspaceScopeFilter = {
    OR: [
      { ownerId: userId, workspaceId: null },   // personal workspace nodes
      { workspaceId: { in: workspaceIds } },    // workspace nodes the user belongs to
    ] as Array<Record<string, unknown>>,
  };

  // Edge case: if user has no workspace memberships, simplify to just ownerId check
  // (but still include workspaceId: null to avoid accidentally pulling workspace nodes)
  if (workspaceIds.length === 0) {
    workspaceScopeFilter.OR = [
      { ownerId: userId, workspaceId: null },
    ];
  }

  return { workspaceScopeFilter, workspaceIds };
}
