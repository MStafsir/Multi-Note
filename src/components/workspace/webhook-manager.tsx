'use client';

// ============================================================
// MODUL 44: Webhook Subscription Manager
// 44.1 — List existing webhooks: URL, event types, active toggle, dates
// 44.1 — Create webhook dialog: target URL, event types checkboxes
// 44.1 — Show signing secret ONCE after creation with copy-to-clipboard
// 44.1 — Toggle active/inactive, View deliveries, Delete with confirmation
// ============================================================

import { useState, useCallback } from 'react';
import {
  Webhook,
  Plus,
  Loader2,
  Copy,
  AlertTriangle,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Globe,
  Activity,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { useWebhookSubscriptions, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from '@/hooks/use-webhooks';
import { WebhookDeliveryDialog } from './webhook-delivery-dialog';
import type { WebhookEventType } from '@/types';

// Event type label/badge mapping
const EVENT_TYPE_CONFIG: Record<WebhookEventType, { label: string; className: string }> = {
  'node.created': { label: 'Node Created', className: 'bg-emerald-600 text-white' },
  'node.deleted': { label: 'Node Deleted', className: 'bg-red-600 text-white' },
  'note.updated': { label: 'Note Updated', className: 'bg-amber-600 text-white' },
  'file.uploaded': { label: 'File Uploaded', className: 'bg-violet-600 text-white' },
};

const ALL_EVENT_TYPES: WebhookEventType[] = ['node.created', 'node.deleted', 'note.updated', 'file.uploaded'];

export function WebhookManager() {
  const { data: webhooks, isLoading } = useWebhookSubscriptions();
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const deleteMutation = useDeleteWebhook();

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedEventTypes, setSelectedEventTypes] = useState<WebhookEventType[]>(['node.created']);
  const [newWebhookSecret, setNewWebhookSecret] = useState<{ id: string; secret: string } | null>(null);
  const [showSecretDialogOpen, setShowSecretDialogOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string>('');

  // Delivery dialog state
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliverySubscriptionId, setDeliverySubscriptionId] = useState<string>('');

  // Handle create webhook
  const handleCreate = useCallback(async () => {
    try {
      const result = await createMutation.mutateAsync({
        targetUrl,
        eventTypes: selectedEventTypes,
      });
      setNewWebhookSecret({ id: result.id, secret: result.secret });
      setCreateDialogOpen(false);
      setShowSecretDialogOpen(true);
      setTargetUrl('');
      setSelectedEventTypes(['node.created']);
    } catch {
      // Error handled by mutation
    }
  }, [createMutation, targetUrl, selectedEventTypes]);

  // Handle toggle active/inactive
  const handleToggleActive = useCallback(async (subscriptionId: string, currentActive: boolean) => {
    try {
      await updateMutation.mutateAsync({
        subscriptionId,
        payload: { isActive: !currentActive },
      });
    } catch {
      // Error handled by mutation
    }
  }, [updateMutation]);

  // Handle delete webhook
  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(deleteWebhookId);
      setDeleteDialogOpen(false);
      setDeleteWebhookId('');
    } catch {
      // Error handled by mutation
    }
  }, [deleteMutation, deleteWebhookId]);

  // Copy secret to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const allWebhooks = webhooks || [];

  return (
    <div className="space-y-6">
      {/* Webhook List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Subscriptions
            </CardTitle>
            <Button
              className="min-h-[44px]"
              onClick={() => {
                setTargetUrl('');
                setSelectedEventTypes(['node.created']);
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </div>
          <CardDescription>
            Manage outbound webhook subscriptions to receive real-time event notifications. The signing secret is shown only once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allWebhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Webhook className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium text-muted-foreground">No webhook subscriptions yet</p>
              <p className="text-sm text-muted-foreground">
                Create a webhook to receive event notifications at your endpoint.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allWebhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Target URL */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <code className="text-sm font-mono truncate">{webhook.targetUrl}</code>
                    </div>

                    {/* Active/Inactive toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Label htmlFor={`webhook-active-${webhook.id}`} className="text-xs text-muted-foreground">
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </Label>
                      <Switch
                        id={`webhook-active-${webhook.id}`}
                        checked={webhook.isActive}
                        onCheckedChange={() => handleToggleActive(webhook.id, webhook.isActive)}
                        disabled={updateMutation.isPending}
                      />
                    </div>
                  </div>

                  {/* Event types badges */}
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {webhook.eventTypes.map((eventType) => {
                      const config = EVENT_TYPE_CONFIG[eventType] || { label: eventType, className: '' };
                      return (
                        <Badge key={eventType} className={config.className}>
                          {config.label}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Secret (masked) + dates + actions */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Secret: <code className="font-mono bg-muted px-1 rounded">{webhook.secret}</code></span>
                      <span>Created {new Date(webhook.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => {
                          setDeliverySubscriptionId(webhook.id);
                          setDeliveryDialogOpen(true);
                        }}
                        aria-label={`View deliveries for webhook ${webhook.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteWebhookId(webhook.id);
                          setDeleteDialogOpen(true);
                        }}
                        aria-label={`Delete webhook ${webhook.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== Create Webhook Dialog ========== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Webhook
            </DialogTitle>
            <DialogDescription>
              Specify the target URL and select which events to subscribe to. The signing secret will be shown only once after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target URL input */}
            <div>
              <Label htmlFor="webhook-target-url">Target URL</Label>
              <Input
                id="webhook-target-url"
                type="url"
                placeholder="https://example.com/webhooks/receive"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is the URL where we will send HTTP POST requests for each event.
              </p>
            </div>

            {/* Event type checkboxes */}
            <div>
              <Label className="mb-3 block">Event Types</Label>
              <div className="space-y-3">
                {ALL_EVENT_TYPES.map((eventType) => {
                  const config = EVENT_TYPE_CONFIG[eventType];
                  return (
                    <div key={eventType} className="flex items-center gap-3">
                      <Checkbox
                        id={`event-${eventType}`}
                        checked={selectedEventTypes.includes(eventType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEventTypes([...selectedEventTypes, eventType]);
                          } else {
                            setSelectedEventTypes(selectedEventTypes.filter(t => t !== eventType));
                          }
                        }}
                      />
                      <Label htmlFor={`event-${eventType}`} className="flex items-center gap-2 cursor-pointer">
                        <Badge className={config.className}>{config.label}</Badge>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createMutation.isPending}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!targetUrl || selectedEventTypes.length === 0 || createMutation.isPending}
              className="min-h-[44px]"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Webhook'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Show Secret Dialog (shown ONCE after creation) ========== */}
      <Dialog open={showSecretDialogOpen} onOpenChange={setShowSecretDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Webhook Created
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-1 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                This signing secret will only be shown once! Copy it now and store it securely.
              </div>
            </DialogDescription>
          </DialogHeader>

          {newWebhookSecret && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="mb-1 block">Signing Secret</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newWebhookSecret.secret}
                    readOnly
                    className="font-mono text-sm bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => copyToClipboard(newWebhookSecret.secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Use this secret to verify webhook payloads with HMAC-SHA256 signing.
                Each webhook request includes a <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> header
                that you can verify against this secret.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSecretDialogOpen(false);
                setNewWebhookSecret(null);
              }}
              className="min-h-[44px]"
            >
              I&apos;ve Copied the Secret — Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Delete Webhook Confirmation ========== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Webhook Subscription?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the webhook subscription and all associated delivery records.
              Your endpoint will no longer receive event notifications.
              <br /><br />
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="min-h-[44px]"
              onClick={() => setDeleteWebhookId('')}
            >
              Keep Webhook
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Webhook'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========== Delivery History Dialog ========== */}
      <WebhookDeliveryDialog
        subscriptionId={deliverySubscriptionId}
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
      />
    </div>
  );
}
