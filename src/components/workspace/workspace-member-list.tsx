'use client';

// ============================================================
// MODUL 40-41: Workspace Member Management — List of workspace members
// Table/list with: avatar, name, email, role badge, joined date
// "Change Role" button for admin/owner — opens a Select dropdown
// "Remove Member" button — confirmation dialog
// "Invite Member" button — opens invitation dialog
// ============================================================

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Shield, Trash2, Loader2, Crown, UserCircle,
  AlertTriangle, MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaceStore } from '@/store/workspace';
import { useAuthStore } from '@/store/auth';
import { useWorkspaceMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks/use-workspace';
import { WorkspaceInviteDialog } from './workspace-invite-dialog';
import type { WorkspaceRole, WorkspaceMemberInfo } from '@/types';

// Role badge color mapping
const ROLE_COLORS: Record<WorkspaceRole, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700',
  admin: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-300 dark:border-sky-700',
  member: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

// Role icon mapping
const ROLE_ICONS: Record<WorkspaceRole, React.ReactNode> = {
  owner: <Crown className="h-3 w-3 text-amber-600" />,
  admin: <Shield className="h-3 w-3 text-sky-600" />,
  member: <UserCircle className="h-3 w-3 text-neutral-500" />,
  viewer: <UserCircle className="h-3 w-3 text-gray-500" />,
};

interface WorkspaceMemberListProps {
  workspaceId: string;
}

export function WorkspaceMemberList({ workspaceId }: WorkspaceMemberListProps) {
  const { user } = useAuthStore();
  const { currentWorkspaceRole } = useWorkspaceStore();
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
  const updateRoleMutation = useUpdateMemberRole(workspaceId);
  const removeMemberMutation = useRemoveMember(workspaceId);

  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Remove member confirmation state
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMemberInfo | null>(null);

  // Role change state
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<WorkspaceRole>('member');

  // Current user's permissions
  const isOwnerOrAdmin = currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin';
  const isOwner = currentWorkspaceRole === 'owner';

  // Handle role change
  const handleRoleChange = (memberId: string, role: WorkspaceRole) => {
    setChangingRoleMemberId(memberId);
    setNewRole(role);
    updateRoleMutation.mutate(
      { memberId, role },
      {
        onSuccess: () => {
          setChangingRoleMemberId(null);
        },
        onError: () => {
          setChangingRoleMemberId(null);
        },
      }
    );
  };

  // Handle remove member
  const handleRemoveMember = () => {
    if (!removeTarget) return;
    removeMemberMutation.mutate(
      { memberId: removeTarget.id },
      {
        onSuccess: () => {
          setRemoveTarget(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No members yet</p>
        <p className="text-xs text-muted-foreground mt-1">Invite people to collaborate in this workspace</p>
        {isOwnerOrAdmin && (
          <Button
            size="sm"
            className="mt-3 min-h-[44px]"
            onClick={() => setInviteDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Invite Member
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Members</span>
          <Badge variant="secondary" className="text-xs">
            {members.length}
          </Badge>
        </div>
        {isOwnerOrAdmin && (
          <Button
            size="sm"
            className="min-h-[44px]"
            onClick={() => setInviteDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Invite
          </Button>
        )}
      </div>

      <Separator />

      {/* Member list */}
      <ScrollArea className="max-h-96">
        <AnimatePresence initial={false}>
          {members.map((member, index) => {
            const memberUser = member.user as { id: string; email: string; name: string | null; image?: string | null } | undefined;
            const displayName = memberUser?.name || memberUser?.email || 'Unknown';
            const displayEmail = memberUser?.email || '';
            const displayInitial = displayName.charAt(0).toUpperCase();
            const isPending = !member.joinedAt;
            const isCurrentUser = memberUser?.id === user?.id;
            const isMemberOwner = member.role === 'owner';
            const isChangingRole = changingRoleMemberId === member.id && updateRoleMutation.isPending;
            const isRemoving = removeTarget?.id === member.id && removeMemberMutation.isPending;

            // Can this member's role be changed?
            const canChangeRole = isOwnerOrAdmin && !isMemberOwner && !isCurrentUser && member.joinedAt;
            // Can this member be removed?
            const canRemove = isOwnerOrAdmin && !isMemberOwner && !isCurrentUser;

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors"
              >
                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={memberUser?.image || undefined} alt={displayName} />
                  <AvatarFallback className="text-xs font-medium">
                    {displayInitial}
                  </AvatarFallback>
                </Avatar>

                {/* Name & email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">
                      {displayName}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                    {isPending && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-amber-600 border-amber-300">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                  {member.joinedAt && (
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>

                {/* Role badge */}
                {isChangingRole ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 h-6 shrink-0 flex items-center gap-1 ${ROLE_COLORS[member.role as WorkspaceRole] ?? ROLE_COLORS.member}`}
                  >
                    {ROLE_ICONS[member.role as WorkspaceRole] ?? ROLE_ICONS.member}
                    {member.role}
                  </Badge>
                )}

                {/* Actions dropdown (for admin/owner) */}
                {(canChangeRole || canRemove) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 min-h-[44px] min-w-[44px]"
                        disabled={isRemoving}
                        aria-label={`Actions for ${displayName}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {canChangeRole && (
                        <>
                          <DropdownMenuLabel className="text-xs">Change Role</DropdownMenuLabel>
                          {(['admin', 'member', 'viewer'] as WorkspaceRole[]).map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => handleRoleChange(member.id, role)}
                              disabled={member.role === role || updateRoleMutation.isPending}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              {ROLE_ICONS[role]}
                              <span className="capitalize">{role}</span>
                              {member.role === role && (
                                <span className="text-xs text-muted-foreground ml-auto">current</span>
                              )}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {canRemove && (
                        <DropdownMenuItem
                          onClick={() => setRemoveTarget(member)}
                          className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </ScrollArea>

      {/* Remove member confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{removeTarget?.user?.name || removeTarget?.user?.email || 'this member'}</strong>{' '}
              from this workspace? They will lose access to all workspace content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMemberMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removeMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite dialog */}
      <WorkspaceInviteDialog
        workspaceId={workspaceId}
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
