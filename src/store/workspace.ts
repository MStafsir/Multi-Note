// ============================================================
// MODUL 40-41: Zustand Store — Workspace Context Management
// Tracks current workspace context (null = personal workspace)
// Switching workspace: components call invalidateWorkspaceCaches()
// after setCurrentWorkspace to prevent data-leak (40.5)
// ============================================================

import { create } from 'zustand';
import type { WorkspaceInfo, WorkspaceRole } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

interface WorkspaceState {
  // Current workspace context (null = personal workspace)
  currentWorkspaceId: string | null;
  currentWorkspaceName: string | null;
  currentWorkspaceRole: WorkspaceRole | null;

  // Available workspaces for this user
  workspaces: WorkspaceInfo[];

  // Current user's role in each workspace (keyed by workspace ID)
  workspaceRoles: Record<string, WorkspaceRole>;

  // Actions
  setCurrentWorkspace: (id: string | null, name: string | null, role?: WorkspaceRole | null) => void;
  setWorkspaces: (workspaces: WorkspaceInfo[], roles?: Record<string, WorkspaceRole>) => void;
  clearWorkspace: () => void; // reset to personal
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspaceId: null,
  currentWorkspaceName: null,
  currentWorkspaceRole: null,
  workspaces: [],
  workspaceRoles: {},

  setCurrentWorkspace: (id, name, role) => {
    set({
      currentWorkspaceId: id,
      currentWorkspaceName: name,
      currentWorkspaceRole: role ?? (id ? get().workspaceRoles[id] ?? null : null),
    });
  },

  setWorkspaces: (workspaces, roles) => {
    const workspaceRoles = roles ?? {};
    // If roles weren't provided, try to derive from workspaces data
    // The API response includes role for each workspace
    if (!roles && workspaces.length > 0) {
      for (const ws of workspaces as (WorkspaceInfo & { role?: WorkspaceRole })[]) {
        if (ws.role) {
          workspaceRoles[ws.id] = ws.role;
        }
      }
    }
    set({ workspaces, workspaceRoles });
  },

  clearWorkspace: () => {
    set({
      currentWorkspaceId: null,
      currentWorkspaceName: null,
      currentWorkspaceRole: null,
    });
  },
}));

// ============================================================
// 40.5 — Helper: Invalidate ALL React Query caches on workspace switch
// Must be called by React components (which have access to QueryClient)
// after calling setCurrentWorkspace / clearWorkspace
// ============================================================

export function invalidateWorkspaceCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['nodes'] });
  queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
  queryClient.invalidateQueries({ queryKey: ['storage-quota'] });
  queryClient.invalidateQueries({ queryKey: ['favorites'] });
  queryClient.invalidateQueries({ queryKey: ['activity'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}
