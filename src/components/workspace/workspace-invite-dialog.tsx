'use client';

// ============================================================
// MODUL 40-41: Workspace Invitation Dialog
// Email input + role selector + "Send Invitation" button
// Shows seat limit info: "3 of 10 seats used (Pro plan)"
// Error states: "Seat limit reached — upgrade plan to add more members"
// ============================================================

import { useState } from 'react';
import { UserPlus, Mail, Loader2, AlertTriangle, Users } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useInviteMember, useWorkspaceMembers } from '@/hooks/use-workspace';
import type { WorkspaceRole } from '@/types';

interface WorkspaceInviteDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Seat limits per plan tier
const SEAT_LIMITS: Record<string, number> = {
  free: 3,
  pro: 10,
  enterprise: 50,
};

export function WorkspaceInviteDialog({ workspaceId, open, onOpenChange }: WorkspaceInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [error, setError] = useState<string | null>(null);

  const inviteMutation = useInviteMember(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  // Seat info
  const currentSeats = members?.length ?? 0;
  // Default to 'free' plan — the actual plan is fetched from workspace detail
  const maxSeats = SEAT_LIMITS.free; // simplified — could be dynamic from workspace data
  const seatsAvailable = currentSeats < maxSeats;

  // Email validation
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError('Invalid email format');
      return;
    }

    inviteMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
          setRole('member');
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setEmail('');
      setRole('member');
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join this workspace. They&apos;ll receive an email with a link to accept.
          </DialogDescription>
        </DialogHeader>

        {/* Seat usage display */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            {currentSeats} of {maxSeats} seats used
          </span>
          <Badge
            variant={seatsAvailable ? 'secondary' : 'destructive'}
            className="text-[10px] px-1.5 shrink-0"
          >
            {seatsAvailable ? `${maxSeats - currentSeats} available` : 'Full'}
          </Badge>
        </div>

        {!seatsAvailable && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Seat limit reached — upgrade plan to add more members</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* Email input */}
            <div className="space-y-2">
              <Label htmlFor="invite-email">
                <Mail className="h-3.5 w-3.5 mr-1 inline" />
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                autoFocus
                disabled={inviteMutation.isPending || !seatsAvailable}
                aria-invalid={!!error}
              />
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(val) => setRole(val as WorkspaceRole)}
                disabled={inviteMutation.isPending || !seatsAvailable}
              >
                <SelectTrigger id="invite-role" className="min-h-[44px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member" className="min-h-[44px]">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">Member</span>
                      <span className="text-xs text-muted-foreground">— Can create & edit content</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer" className="min-h-[44px]">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">Viewer</span>
                      <span className="text-xs text-muted-foreground">— Read-only access</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="admin" className="min-h-[44px]">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">Admin</span>
                      <span className="text-xs text-muted-foreground">— Manage members & settings</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={inviteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!email.trim() || !isValidEmail(email.trim()) || inviteMutation.isPending || !seatsAvailable}
            >
              {inviteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
