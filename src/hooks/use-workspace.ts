// ============================================================
// MODUL 40-41: Workspace React Query Hooks
// Data fetching & mutations for workspace CRUD, members, invitations
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { WorkspaceInfo, WorkspaceRole, WorkspaceMemberInfo, WorkspaceInvitationInfo } from '@/types';
import { useWorkspaceStore, invalidateWorkspaceCaches } from '@/store/workspace';
import { useAuthStore } from '@/store/auth';

// --- Query Keys ---
const WORKSPACE_KEYS = {
  all: ['workspaces'] as const,
  list: ['workspaces', 'list'] as const,
  detail: (id: string) => ['workspaces', 'detail', id] as const,
  members: (id: string) => ['workspace-members', id] as const,
  invitations: ['workspaces', 'invitations'] as const,
};

// --- GET: List all workspaces for current user ---
export function useWorkspaces() {
  const { user } = useAuthStore();
  const { setWorkspaces } = useWorkspaceStore();

  return useQuery({
    queryKey: WORKSPACE_KEYS.list,
    queryFn: async () => {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const workspaces: (WorkspaceInfo & { role: WorkspaceRole; memberCount: number; nodeCount: number })[] = data.data;
      const roles: Record<string, WorkspaceRole> = {};
      for (const ws of workspaces) {
        roles[ws.id] = ws.role;
      }

      // Sync with Zustand store
      setWorkspaces(workspaces, roles);

      return workspaces;
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

// --- GET: Get workspace details ---
export function useWorkspace(id: string) {
  return useQuery({
    queryKey: WORKSPACE_KEYS.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as WorkspaceInfo & {
        role?: WorkspaceRole;
        memberCount?: number;
        nodeCount?: number;
        members: WorkspaceMemberInfo[];
      };
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

// --- GET: List workspace members ---
export function useWorkspaceMembers(id: string) {
  return useQuery({
    queryKey: WORKSPACE_KEYS.members(id),
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${id}/members`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as WorkspaceMemberInfo[];
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

// --- GET: Get pending invitations for current user ---
export function useWorkspaceInvitations() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: WORKSPACE_KEYS.invitations,
    queryFn: async () => {
      // Fetch notifications that contain workspace invitations
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Filter notifications for workspace invitations (share_received type with invitationToken)
      const notifications = data.data.notifications as Array<{
        id: string;
        type: string;
        payload: Record<string, unknown>;
        readAt: string | null;
        createdAt: string;
      }>;

      const invitations: WorkspaceInvitationInfo[] = notifications
        .filter((n) => n.type === 'share_received' && n.payload?.invitationToken)
        .map((n) => ({
          id: n.id,
          workspaceId: n.payload.workspaceId as string,
          workspaceName: n.payload.workspaceName as string,
          email: user?.email ?? '',
          role: n.payload.role as WorkspaceRole,
          token: n.payload.invitationToken as string,
          invitedBy: n.payload.invitedByUserId as string,
          expiresAt: '', // not in notification payload, fetched on demand
          acceptedAt: null,
          declinedAt: null,
          createdAt: n.createdAt,
        }));

      return invitations;
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

// --- GET: Get invitation details by token ---
export function useInvitationDetails(token: string | null) {
  return useQuery({
    queryKey: ['workspaces', 'invitation', token],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/invitations/${token}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as {
        id: string;
        workspaceId: string;
        workspaceName: string;
        workspacePlanTier: string;
        email: string;
        role: WorkspaceRole;
        invitedBy: { id: string; name: string | null; email: string } | null;
        expiresAt: string;
        createdAt: string;
      };
    },
    enabled: !!token,
    staleTime: 60000,
  });
}

// --- POST: Create workspace ---
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
      toast.success(`Workspace "${newWorkspace.name}" created`);
    },
    onError: (error) => {
      toast.error(`Failed to create workspace: ${error.message}`);
    },
  });
}

// --- POST: Invite member to workspace ---
export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: WorkspaceRole }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
      toast.success('Invitation sent');
    },
    onError: (error) => {
      toast.error(`Failed to invite member: ${error.message}`);
    },
  });
}

// --- PATCH: Update member role ---
export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: WorkspaceRole }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.members(workspaceId) });
      toast.success('Member role updated');
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}

// --- DELETE: Remove member from workspace ---
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
      toast.success('Member removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });
}

// --- POST: Transfer workspace ownership (41.5) ---
export function useTransferOwnership(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetMemberId }: { targetMemberId: string }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMemberId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.detail(workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
      toast.success('Ownership transferred');
    },
    onError: (error) => {
      toast.error(`Failed to transfer ownership: ${error.message}`);
    },
  });
}

// --- POST: Accept invitation ---
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { setCurrentWorkspace } = useWorkspaceStore();

  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const res = await fetch(`/api/workspaces/invitations/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as { workspaceId: string; workspaceName: string; role: WorkspaceRole };
    },
    onSuccess: (result) => {
      // Switch to the newly joined workspace
      setCurrentWorkspace(result.workspaceId, result.workspaceName, result.role);
      invalidateWorkspaceCaches(queryClient);
      toast.success(`Joined workspace "${result.workspaceName}"`);
    },
    onError: (error) => {
      toast.error(`Failed to accept invitation: ${error.message}`);
    },
  });
}

// --- PATCH: Decline invitation ---
export function useDeclineInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const res = await fetch(`/api/workspaces/invitations/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.invitations });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Invitation declined');
    },
    onError: (error) => {
      toast.error(`Failed to decline invitation: ${error.message}`);
    },
  });
}

// --- PATCH: Update workspace name ---
export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, planTier }: { name?: string; planTier?: string }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, planTier }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.detail(workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
      // Update workspace store name if current workspace
      const { currentWorkspaceId, setCurrentWorkspace, workspaceRoles } = useWorkspaceStore.getState();
      if (currentWorkspaceId === workspaceId) {
        setCurrentWorkspace(workspaceId, updated.name, workspaceRoles[workspaceId] ?? null);
      }
      toast.success('Workspace updated');
    },
    onError: (error) => {
      toast.error(`Failed to update workspace: ${error.message}`);
    },
  });
}

// --- DELETE: Delete workspace (owner only) ---
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  const { clearWorkspace } = useWorkspaceStore();

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (_, { workspaceId }) => {
      const { currentWorkspaceId } = useWorkspaceStore.getState();
      if (currentWorkspaceId === workspaceId) {
        clearWorkspace();
        invalidateWorkspaceCaches(queryClient);
      }
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
      toast.success('Workspace deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete workspace: ${error.message}`);
    },
  });
}

export { WORKSPACE_KEYS };
