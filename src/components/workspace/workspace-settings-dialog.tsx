'use client';

// ============================================================
// MODUL 40-41: Workspace Settings Dialog
// Workspace name editing, plan tier display, seat usage,
// Ownership transfer (41.5), Delete workspace (owner only)
// ============================================================

import { useState } from 'react';
import {
  Building2, Settings, Pencil, Trash2, Crown, Shield, Users, Loader2,
  AlertTriangle, ArrowRightLeft, ChevronDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceStore } from '@/store/workspace';
import { useAuthStore } from '@/store/auth';
import {
  useWorkspace,
  useWorkspaceMembers,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useTransferOwnership,
} from '@/hooks/use-workspace';
import type { WorkspaceRole } from '@/types';

// Seat limits per plan tier
const SEAT_LIMITS: Record<string, number> = {
  free: 3,
  pro: 10,
  enterprise: 50,
};

// Plan tier display
const PLAN_TIER_LABELS: Record<string, { name: string; color: string }> = {
  free: { name: 'Free', color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
  pro: { name: 'Pro', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  enterprise: { name: 'Enterprise', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
};

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceSettingsDialog({ open, onOpenChange }: WorkspaceSettingsDialogProps) {
  const { currentWorkspaceId, currentWorkspaceRole } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace(currentWorkspaceId ?? '');
  const { data: members } = useWorkspaceMembers(currentWorkspaceId ?? '');
  const updateMutation = useUpdateWorkspace(currentWorkspaceId ?? '');
  const deleteMutation = useDeleteWorkspace();
  const transferMutation = useTransferOwnership(currentWorkspaceId ?? '');

  // Name editing
  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Transfer ownership
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  // Update local state when workspace data loads
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && workspace) {
      setEditName(workspace.name);
      setIsEditingName(false);
      setTransferTargetId('');
    }
    onOpenChange(newOpen);
  };

  // Handle name save
  const handleSaveName = () => {
    if (!editName.trim() || editName.trim() === workspace?.name) {
      setIsEditingName(false);
      return;
    }
    updateMutation.mutate(
      { name: editName.trim() },
      {
        onSuccess: () => {
          setIsEditingName(false);
        },
      }
    );
  };

  // Handle delete
  const handleDelete = () => {
    if (!currentWorkspaceId) return;
    deleteMutation.mutate(
      { workspaceId: currentWorkspaceId },
      {
        onSuccess: () => {
          setDeleteConfirmOpen(false);
          onOpenChange(false);
        },
      }
    );
  };

  // Handle transfer
  const handleTransfer = () => {
    if (!transferTargetId) return;
    transferMutation.mutate(
      { targetMemberId: transferTargetId },
      {
        onSuccess: () => {
          setTransferConfirmOpen(false);
          setTransferTargetId('');
        },
      }
    );
  };

  const isOwner = currentWorkspaceRole === 'owner';
  const isAdminOrOwner = isOwner || currentWorkspaceRole === 'admin';
  const currentSeats = members?.length ?? 0;
  const planInfo = PLAN_TIER_LABELS[workspace?.planTier ?? 'free'];

  // Get admin members for ownership transfer
  const adminMembers = members?.filter(
    (m) => m.role === 'admin' && m.joinedAt && (m.user as { id: string })?.id !== user?.id
  ) ?? [];

  if (!currentWorkspaceId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription>
              Select a workspace to manage its settings.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center py-4">
            You&apos;re currently in your personal workspace. Switch to a shared workspace to access settings.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (workspaceLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Workspace Settings
            </DialogTitle>
            <DialogDescription>
              Manage workspace name, plan, and membership.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-1">
              {/* Workspace Name */}
              <section aria-label="Workspace name">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Name</Label>
                </div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={updateMutation.isPending}
                      autoFocus
                      maxLength={100}
                      className="min-h-[44px]"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={!editName.trim() || updateMutation.isPending}
                      className="min-h-[44px]"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingName(false);
                        setEditName(workspace?.name ?? '');
                      }}
                      disabled={updateMutation.isPending}
                      className="min-h-[44px]"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{workspace?.name ?? 'Untitled'}</span>
                    {isAdminOrOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 min-h-[44px] min-w-[44px]"
                        onClick={() => {
                          setEditName(workspace?.name ?? '');
                          setIsEditingName(true);
                        }}
                        aria-label="Edit workspace name"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Plan Tier */}
              <section aria-label="Plan tier">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Plan</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-sm px-3 py-1 ${planInfo.color}`}>
                    {planInfo.name}
                  </Badge>
                  {workspace?.planTier !== 'enterprise' && isOwner && (
                    <Button variant="link" size="sm" className="text-primary min-h-[44px]">
                      Upgrade Plan
                    </Button>
                  )}
                </div>
              </section>

              <Separator />

              {/* Seat Usage */}
              <section aria-label="Seat usage">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Members</Label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {currentSeats} of {SEAT_LIMITS[workspace?.planTier ?? 'free']} seats used
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {SEAT_LIMITS[workspace?.planTier ?? 'free'] - currentSeats} available
                  </Badge>
                </div>
              </section>

              <Separator />

              {/* Ownership Transfer (41.5) — owner only */}
              {isOwner && adminMembers.length > 0 && (
                <>
                  <section aria-label="Ownership transfer">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                      <Label className="text-sm font-semibold">Transfer Ownership</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Transfer ownership to an existing admin member. You will become an admin after the transfer.
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={transferTargetId}
                        onValueChange={setTransferTargetId}
                        disabled={transferMutation.isPending}
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select admin member..." />
                        </SelectTrigger>
                        <SelectContent>
                          {adminMembers.map((m) => {
                            const mUser = m.user as { id: string; name: string | null; email: string };
                            return (
                              <SelectItem key={m.id} value={m.id} className="min-h-[44px]">
                                {mUser?.name || mUser?.email}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTransferConfirmOpen(true)}
                        disabled={!transferTargetId || transferMutation.isPending}
                        className="min-h-[44px]"
                      >
                        {transferMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4 mr-1" />
                        )}
                        Transfer
                      </Button>
                    </div>
                  </section>
                  <Separator />
                </>
              )}

              {/* Delete Workspace — owner only */}
              {isOwner && (
                <section aria-label="Delete workspace">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <Label className="text-sm font-semibold text-destructive">Danger Zone</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Deleting this workspace will permanently remove all workspace content, members, and invitations. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Workspace
                  </Button>
                </section>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete workspace confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{workspace?.name ?? 'this workspace'}</strong>? This will permanently
              remove all workspace content, members, and invitations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer ownership confirmation */}
      <AlertDialog open={transferConfirmOpen} onOpenChange={setTransferConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-600" />
              Transfer Ownership
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to transfer ownership of{' '}
              <strong>{workspace?.name ?? 'this workspace'}</strong> to{' '}
              <strong>{adminMembers.find(m => m.id === transferTargetId)?.user?.name || 'this member'}</strong>?{' '}
              You will become an admin after the transfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
