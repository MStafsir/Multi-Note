'use client';

// ============================================================
// MODUL 13: ShareDialog — Share a node with users or via public link
// ============================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Share2,
  Copy,
  Link2,
  Trash2,
  Loader2,
  Clock,
  Eye,
  MessageSquare,
  Pencil,
  Users,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { NodeShareInfo, SharePermission, TreeNode } from '@/types';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: TreeNode | null;
}

const PERMISSION_ICONS: Record<SharePermission, typeof Eye> = {
  view: Eye,
  comment: MessageSquare,
  edit: Pencil,
};

const PERMISSION_LABELS: Record<SharePermission, string> = {
  view: 'Can view',
  comment: 'Can comment',
  edit: 'Can edit',
};

export function ShareDialog({ open, onOpenChange, node }: ShareDialogProps) {
  const [emailInput, setEmailInput] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<SharePermission>('view');
  const [generateLink, setGenerateLink] = useState(false);
  const [expiryHours, setExpiryHours] = useState<string>('24');
  const [copiedLink, setCopiedLink] = useState(false);

  const queryClient = useQueryClient();

  // Fetch shares for this node
  const sharesQuery = useQuery({
    queryKey: ['shares', node?.id],
    queryFn: async () => {
      if (!node?.id) return [];
      const res = await fetch(`/api/shares?nodeId=${node.id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NodeShareInfo[];
    },
    enabled: !!node?.id && open,
  });

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: async (params: {
      nodeId: string;
      sharedWithUserId?: string | null;
      permissionLevel: SharePermission;
      generateLink: boolean;
      linkType?: 'public' | 'private';
      expiryHours?: number;
    }) => {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', node?.id] });
      toast.success('Share created successfully');
      setEmailInput('');
      setGenerateLink(false);
    },
    onError: (error) => {
      toast.error(`Failed to create share: ${error.message}`);
    },
  });

  // Remove share mutation
  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const res = await fetch(`/api/shares/${shareId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', node?.id] });
      toast.success('Share removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove share: ${error.message}`);
    },
  });

  // Handle share with user by email
  const handleShareWithEmail = async () => {
    if (!node?.id || !emailInput.trim()) return;

    try {
      // First, look up the user by email to get their userId
      const lookupRes = await fetch(`/api/users/lookup?email=${encodeURIComponent(emailInput.trim())}`);
      const lookupData = await lookupRes.json();

      if (!lookupData.success) {
        toast.error(lookupData.error || 'User not found');
        return;
      }

      const userId = lookupData.data.id;

      // Then create the share with the resolved userId
      createShareMutation.mutate({
        nodeId: node.id,
        sharedWithUserId: userId,
        permissionLevel: selectedPermission,
        generateLink: false,
      });
    } catch (error) {
      toast.error('Failed to find user');
    }
  };

  // Handle create public share link
  const handleCreateLink = async () => {
    if (!node?.id) return;

    createShareMutation.mutate({
      nodeId: node.id,
      sharedWithUserId: null,
      permissionLevel: selectedPermission,
      generateLink: true,
      linkType: 'public',
      expiryHours: parseInt(expiryHours) || undefined,
    });
  };

  // Copy share link
  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Share link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Reset state when dialog opens — use key on DialogContent instead
  // (see Dialog key={open ? 'open' : 'closed'} approach below)

  if (!node) return null;

  const shares = sharesQuery.data || [];
  const userShares = shares.filter(s => s.sharedWithUserId);
  const linkShares = shares.filter(s => s.shareLinkToken);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" key={open ? 'open' : 'closed'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share &quot;{node.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Share this {node.type} with others or create a public link.
            {node.type === 'folder' && (
              <span className="text-orange-600 font-medium mt-1 block">
                Sharing a folder will share all contents inside it.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Share with user by email */}
        <div className="space-y-3 mt-2">
          <Label className="text-sm font-medium">Share with a user</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1"
              type="email"
            />
            <Select
              value={selectedPermission}
              onValueChange={(v) => setSelectedPermission(v as SharePermission)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> View
                  </span>
                </SelectItem>
                <SelectItem value="comment">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Comment
                  </span>
                </SelectItem>
                <SelectItem value="edit">
                  <span className="flex items-center gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleShareWithEmail}
              disabled={!emailInput.trim() || createShareMutation.isPending}
            >
              {createShareMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Share'
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Create public share link */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Create public share link
            </Label>
            <Switch
              checked={generateLink}
              onCheckedChange={setGenerateLink}
            />
          </div>

          {generateLink && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Permission</Label>
                <Select
                  value={selectedPermission}
                  onValueChange={(v) => setSelectedPermission(v as SharePermission)}
                >
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Can view</SelectItem>
                    <SelectItem value="comment">Can comment</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs">Expires in</Label>
                <Select value={expiryHours} onValueChange={setExpiryHours}>
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                onClick={handleCreateLink}
                disabled={createShareMutation.isPending}
                className="w-full"
              >
                {createShareMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Link2 className="h-4 w-4 mr-1" />
                )}
                Generate link
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Existing shares list */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            People with access
          </Label>

          {sharesQuery.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!sharesQuery.isLoading && shares.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No shares yet. Share with a user or create a link above.
            </p>
          )}

          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {/* User shares */}
              {userShares.map((share) => {
                const PermIcon = PERMISSION_ICONS[share.permissionLevel];
                return (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium">
                          {share.sharedWithEmail?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {share.sharedWithName || share.sharedWithEmail || 'Unknown user'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {share.sharedWithEmail}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        <PermIcon className="h-3 w-3 mr-1" />
                        {PERMISSION_LABELS[share.permissionLevel as SharePermission]}
                      </Badge>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeShareMutation.mutate(share.id)}
                              disabled={removeShareMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove share</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}

              {/* Link shares */}
              {linkShares.map((share) => {
                const PermIcon = PERMISSION_ICONS[share.permissionLevel];
                const isExpired = share.isExpired;
                return (
                  <div
                    key={share.id}
                    className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/50
                      ${isExpired ? 'opacity-60' : ''}
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          Public link
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {share.shareLinkExpiry ? (
                            <>
                              <Clock className="h-3 w-3" />
                              {isExpired ? 'Expired' : `Expires ${new Date(share.shareLinkExpiry).toLocaleDateString()}`}
                            </>
                          ) : (
                            'No expiry'
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={isExpired ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        <PermIcon className="h-3 w-3 mr-1" />
                        {PERMISSION_LABELS[share.permissionLevel as SharePermission]}
                      </Badge>
                      {!isExpired && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => share.shareLinkToken && handleCopyLink(share.shareLinkToken)}
                              >
                                {copiedLink ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy link</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeShareMutation.mutate(share.id)}
                              disabled={removeShareMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove link</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {node.type === 'folder' && shares.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>This folder share includes all contents inside.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
