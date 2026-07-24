'use client';

// ============================================================
// MODUL 40-41: Workspace Invitation View — Accept/Decline invitations
// Shows pending workspace invitations in a modal/dialog
// Displays: workspace name, inviter email, role offered, expiry date
// "Accept" and "Decline" buttons
// ============================================================

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Mail, Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkspaceInvitations, useInvitationDetails, useAcceptInvitation, useDeclineInvitation } from '@/hooks/use-workspace';
import type { WorkspaceRole } from '@/types';

// Role badge color mapping
const ROLE_COLORS: Record<WorkspaceRole, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  member: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface WorkspaceInvitationViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceInvitationView({ open, onOpenChange }: WorkspaceInvitationViewProps) {
  const { data: invitations, isLoading } = useWorkspaceInvitations();
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  // Selected invitation for detailed view
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const { data: invitationDetails, isLoading: detailsLoading } = useInvitationDetails(selectedToken);

  // Handle accept
  const handleAccept = (token: string) => {
    acceptMutation.mutate(
      { token },
      {
        onSuccess: () => {
          setSelectedToken(null);
          onOpenChange(false);
        },
      }
    );
  };

  // Handle decline
  const handleDecline = (token: string) => {
    declineMutation.mutate(
      { token },
      {
        onSuccess: () => {
          setSelectedToken(null);
        },
      }
    );
  };

  const pendingInvitations = invitations ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Workspace Invitations
          </DialogTitle>
          <DialogDescription>
            You have pending invitations to join workspaces.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : pendingInvitations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No pending invitations</p>
            <p className="text-xs text-muted-foreground mt-1">
              When someone invites you to a workspace, you&apos;ll see it here.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-60">
            <AnimatePresence initial={false}>
              {pendingInvitations.map((invitation, index) => (
                <motion.div
                  key={invitation.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-accent/30 transition-colors cursor-pointer rounded-sm"
                  onClick={() => setSelectedToken(invitation.token)}
                >
                  {/* Workspace icon */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{invitation.workspaceName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${ROLE_COLORS[invitation.role] ?? ROLE_COLORS.member}`}
                      >
                        {invitation.role}
                      </Badge>
                      {invitation.expiresAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 min-h-[44px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAccept(invitation.token);
                      }}
                      disabled={acceptMutation.isPending}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 min-h-[44px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecline(invitation.token);
                      }}
                      disabled={declineMutation.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Decline
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </ScrollArea>
        )}

        {/* Detailed invitation view */}
        {selectedToken && invitationDetails && (
          <div className="mt-3 p-4 rounded-lg border bg-accent/20">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-primary" />
              <h4 className="text-sm font-semibold">{invitationDetails.workspaceName}</h4>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Invited by:</span>
                <span className="font-medium">
                  {invitationDetails.invitedBy?.name || invitationDetails.invitedBy?.email || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 ${ROLE_COLORS[invitationDetails.role] ?? ROLE_COLORS.member}`}
                >
                  {invitationDetails.role} role
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Expires:</span>
                <span>{formatDistanceToNow(new Date(invitationDetails.expiresAt), { addSuffix: true })}</span>
              </div>
            </div>

            {detailsLoading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {invitationDetails.expiresAt && new Date(invitationDetails.expiresAt) < new Date() && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-destructive/10 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>This invitation has expired</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
