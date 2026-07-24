// ============================================================
// MODUL 13: Permission Checks — Application-level RLS equivalent
// Checks if a user has access to a node via ownership or share records
// Includes cascading permission for folder ancestors
// ============================================================

import { db } from '@/lib/db';

export type PermissionLevel = 'view' | 'comment' | 'edit';

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  view: 1,
  comment: 2,
  edit: 3,
};

/**
 * Check if a user has at least `requiredLevel` access to a node.
 * 1. Checks if user is the owner → always has full access.
 * 2. MODUL 40.3 — Checks workspace membership (if node has workspaceId).
 *    Union condition: owner_id = userId OR (workspaceId exists AND user is workspace member with appropriate role)
 * 3. Checks NodeShare table for direct share on this node.
 * 4. Checks ancestor nodes for cascaded share (recursive parent lookup).
 */
export async function checkNodeAccess(
  userId: string,
  nodeId: string,
  requiredLevel: PermissionLevel
): Promise<{ hasAccess: boolean; permissionLevel: PermissionLevel | null; viaOwnerId: boolean }> {
  // 1. Check ownership
  const node = await db.node.findUnique({
    where: { id: nodeId },
    select: { ownerId: true, workspaceId: true },
  });

  if (!node) {
    return { hasAccess: false, permissionLevel: null, viaOwnerId: false };
  }

  if (node.ownerId === userId) {
    return { hasAccess: true, permissionLevel: 'edit', viaOwnerId: true };
  }

  // 2. MODUL 40.3 — Workspace member check (RLS equivalent)
  // If node belongs to a workspace, check if user is a workspace member with appropriate role
  if (node.workspaceId) {
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: node.workspaceId, userId },
      },
      select: { role: true, joinedAt: true },
    });

    if (membership && membership.joinedAt) {
      // Workspace role → permission mapping:
      // owner/admin = edit, member = edit, viewer = view
      const rolePermissionMap: Record<string, PermissionLevel> = {
        owner: 'edit',
        admin: 'edit',
        member: 'edit',
        viewer: 'view',
      };

      const memberPermission = rolePermissionMap[membership.role] || 'view';

      // Check if member's permission level satisfies required level
      if (PERMISSION_HIERARCHY[memberPermission] >= PERMISSION_HIERARCHY[requiredLevel]) {
        return { hasAccess: true, permissionLevel: memberPermission, viaOwnerId: false };
      }
    }
  }

  // 3. Check direct share on this node
  const directShare = await db.nodeShare.findFirst({
    where: {
      nodeId,
      sharedWithUserId: userId,
      permissionLevel: { in: getPermissionLevelsAtOrAbove(requiredLevel) },
    },
  });

  if (directShare) {
    return { hasAccess: true, permissionLevel: directShare.permissionLevel as PermissionLevel, viaOwnerId: false };
  }

  // 4. Check ancestor nodes for cascaded share (folder inheritance)
  const ancestorIds = await getAncestorIds(nodeId);

  for (const ancestorId of ancestorIds) {
    const ancestorShare = await db.nodeShare.findFirst({
      where: {
        nodeId: ancestorId,
        sharedWithUserId: userId,
        permissionLevel: { in: getPermissionLevelsAtOrAbove(requiredLevel) },
      },
    });

    if (ancestorShare) {
      return { hasAccess: true, permissionLevel: ancestorShare.permissionLevel as PermissionLevel, viaOwnerId: false };
    }
  }

  return { hasAccess: false, permissionLevel: null, viaOwnerId: false };
}

/**
 * Check if a user can edit a node (owner OR edit-level share).
 */
export async function canEditNode(userId: string, nodeId: string): Promise<boolean> {
  const result = await checkNodeAccess(userId, nodeId, 'edit');
  return result.hasAccess;
}

/**
 * Check if a user can view a node (owner OR any share level).
 */
export async function canViewNode(userId: string, nodeId: string): Promise<boolean> {
  const result = await checkNodeAccess(userId, nodeId, 'view');
  return result.hasAccess;
}

/**
 * Get all ancestor IDs by traversing parentId chain upward.
 */
async function getAncestorIds(nodeId: string): string[] {
  const ancestors: string[] = [];
  let currentId: string | null = nodeId;

  while (currentId) {
    const node = await db.node.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!node || !node.parentId) break;

    ancestors.push(node.parentId);
    currentId = node.parentId;
  }

  return ancestors;
}

/**
 * Get all descendant IDs recursively (for cascading shares on folders).
 */
export async function getAllDescendants(parentId: string): string[] {
  const descendants: string[] = [];
  let currentIds = [parentId];

  while (currentIds.length > 0) {
    const children = await db.node.findMany({
      where: { parentId: { in: currentIds } },
      select: { id: true },
    });
    currentIds = children.map(c => c.id);
    descendants.push(...currentIds);
  }

  return descendants;
}

/**
 * Helper: get all permission levels that satisfy `requiredLevel` or higher.
 */
function getPermissionLevelsAtOrAbove(requiredLevel: PermissionLevel): string[] {
  const required = PERMISSION_HIERARCHY[requiredLevel];
  return Object.entries(PERMISSION_HIERARCHY)
    .filter(([, level]) => level >= required)
    .map(([key]) => key);
}
