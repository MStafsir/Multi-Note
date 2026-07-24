'use client';

// ============================================================
// MODUL 40-41: Workspace Switcher — Header dropdown component
// Shows "Personal" when currentWorkspaceId is null (default)
// Shows workspace name when in a workspace context
// Dropdown: "Personal Workspace" + list of workspaces + "Create Workspace"
// ============================================================

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Users, Plus, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspaceStore, invalidateWorkspaceCaches } from '@/store/workspace';
import { useWorkspaces, useCreateWorkspace } from '@/hooks/use-workspace';
import type { WorkspaceRole } from '@/types';

// Role badge color mapping
const ROLE_COLORS: Record<WorkspaceRole, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  member: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function WorkspaceSwitcher() {
  const queryClient = useQueryClient();
  const { currentWorkspaceId, currentWorkspaceName, workspaces, workspaceRoles, setCurrentWorkspace } = useWorkspaceStore();
  const { data: workspaceList, isLoading } = useWorkspaces();
  const createMutation = useCreateWorkspace();

  // Create workspace dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Handle workspace switch
  const handleSwitchWorkspace = useCallback(
    (id: string | null, name: string | null) => {
      const role = id ? workspaceRoles[id] ?? null : null;
      setCurrentWorkspace(id, name, role);
      // 40.5 — Invalidate ALL React Query caches
      invalidateWorkspaceCaches(queryClient);
    },
    [setCurrentWorkspace, workspaceRoles, queryClient]
  );

  // Handle create workspace
  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    createMutation.mutate(
      { name: newWorkspaceName.trim() },
      {
        onSuccess: (newWs) => {
          setNewWorkspaceName('');
          setCreateDialogOpen(false);
          // Auto-switch to the newly created workspace
          handleSwitchWorkspace(newWs.id, newWs.name);
        },
      }
    );
  };

  // Current workspace display
  const displayLabel = currentWorkspaceName ?? 'Personal';
  const isPersonal = currentWorkspaceId === null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 h-auto px-2 py-1 min-h-[44px] rounded-lg hover:bg-accent/50 transition-colors"
            aria-label={`Switch workspace — currently: ${displayLabel}`}
          >
            <div className={`flex items-center justify-center w-6 h-6 rounded ${isPersonal ? 'bg-neutral-200 dark:bg-neutral-800' : 'bg-primary/10'}`}>
              {isPersonal ? (
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Building2 className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <span className="text-sm font-medium truncate max-w-[120px] hidden sm:inline">
              {displayLabel}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspace
          </DropdownMenuLabel>

          {/* Personal workspace option */}
          <DropdownMenuItem
            onClick={() => handleSwitchWorkspace(null, null)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-800">
              <Users className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="flex-1">Personal Workspace</span>
            {isPersonal && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>

          {workspaces.length > 0 && (
            <DropdownMenuSeparator />
          )}

          {/* Workspace list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            workspaces.map((ws) => {
              const role = workspaceRoles[ws.id] ?? 'member';
              const isActive = currentWorkspaceId === ws.id;

              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleSwitchWorkspace(ws.id, ws.name)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/10">
                    <Building2 className="h-3 w-3 text-primary" />
                  </div>
                  <span className="flex-1 truncate">{ws.name}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${ROLE_COLORS[role as WorkspaceRole] ?? ROLE_COLORS.member}`}
                  >
                    {role}
                  </Badge>
                  {isActive && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })
          )}

          <DropdownMenuSeparator />

          {/* Create workspace option */}
          <DropdownMenuItem
            onClick={() => {
              setNewWorkspaceName('');
              setCreateDialogOpen(true);
            }}
            className="flex items-center gap-2 cursor-pointer text-primary"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Create Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Create Workspace
            </DialogTitle>
            <DialogDescription>
              Create a new workspace to collaborate with your team. You&apos;ll be the owner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateWorkspace}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace name</Label>
                <Input
                  id="ws-name"
                  placeholder="e.g. Team Alpha"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  autoFocus
                  disabled={createMutation.isPending}
                  maxLength={100}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newWorkspaceName.trim() || createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
