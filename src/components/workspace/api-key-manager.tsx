'use client';

// ============================================================
// MODUL 43: API Key Management Panel
// 43.1 — List existing API keys with prefix, scopes, dates, revoked status
// 43.1 — Create new API key dialog with scope selector
// 43.1 — Plaintext key shown ONCE after creation with copy-to-clipboard
// 43.5 — Revoke key with confirmation dialog
// 43.5 — Update scopes for key
// ============================================================

import { useState, useCallback } from 'react';
import {
  Key,
  Plus,
  Loader2,
  Copy,
  AlertTriangle,
  Shield,
  Eye,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useUpdateApiKeyScopes } from '@/hooks/use-api-keys';
import type { ApiKeyScope, ApiKeyCreateResponse } from '@/types';

// Scope badge color mapping
function getScopeBadge(scope: ApiKeyScope): { label: string; className: string } {
  switch (scope) {
    case 'read_only':
      return { label: 'Read Only', className: 'bg-emerald-600 text-white' };
    case 'read_write':
      return { label: 'Read/Write', className: 'bg-amber-600 text-white' };
    case 'admin':
      return { label: 'Admin', className: 'bg-red-600 text-white' };
    default:
      return { label: scope, className: '' };
  }
}

export function ApiKeyManager() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();
  const updateScopesMutation = useUpdateApiKeyScopes();

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['read_only']);
  const [newKeyResponse, setNewKeyResponse] = useState<ApiKeyCreateResponse | null>(null);
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false);

  // Revoke dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string>('');

  // Update scopes dialog state
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateKeyId, setUpdateKeyId] = useState<string>('');
  const [updateScopes, setUpdateScopes] = useState<ApiKeyScope[]>([]);

  // Handle create API key
  const handleCreate = useCallback(async () => {
    try {
      const result = await createMutation.mutateAsync({ scopes: selectedScopes });
      setNewKeyResponse(result);
      setCreateDialogOpen(false);
      setShowKeyDialogOpen(true);
    } catch {
      // Error handled by mutation
    }
  }, [createMutation, selectedScopes]);

  // Handle revoke API key
  const handleRevoke = useCallback(async () => {
    try {
      await revokeMutation.mutateAsync(revokeKeyId);
      setRevokeDialogOpen(false);
      setRevokeKeyId('');
    } catch {
      // Error handled by mutation
    }
  }, [revokeMutation, revokeKeyId]);

  // Handle update scopes
  const handleUpdateScopes = useCallback(async () => {
    try {
      await updateScopesMutation.mutateAsync({ apiKeyId: updateKeyId, scopes: updateScopes });
      setUpdateDialogOpen(false);
      setUpdateKeyId('');
      setUpdateScopes([]);
    } catch {
      // Error handled by mutation
    }
  }, [updateScopesMutation, updateKeyId, updateScopes]);

  // Copy key to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const allApiKeys = apiKeys || [];

  return (
    <div className="space-y-6">
      {/* API Keys List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <Button
              className="min-h-[44px]"
              onClick={() => {
                setSelectedScopes(['read_only']);
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New API Key
            </Button>
          </div>
          <CardDescription>
            Manage your API keys for programmatic access. Keys are shown only once at creation — copy them immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allApiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium text-muted-foreground">No API keys yet</p>
              <p className="text-sm text-muted-foreground">
                Create an API key to access the Unified Workspace API programmatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allApiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  {/* Key prefix */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                    <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded truncate">
                      {apiKey.keyPrefix}...
                    </code>
                  </div>

                  {/* Scopes badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {apiKey.scopes.map((scope) => {
                      const badge = getScopeBadge(scope);
                      return (
                        <Badge key={scope} className={badge.className}>
                          {badge.label}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Dates */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {new Date(apiKey.createdAt).toLocaleDateString()}
                    </span>
                    {apiKey.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        Used {new Date(apiKey.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Revoked status */}
                  {apiKey.revokedAt && (
                    <Badge variant="destructive">Revoked</Badge>
                  )}

                  {/* Actions */}
                  {!apiKey.revokedAt && (
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => {
                          setUpdateKeyId(apiKey.id);
                          setUpdateScopes([...apiKey.scopes]);
                          setUpdateDialogOpen(true);
                        }}
                        aria-label={`Update scopes for key ${apiKey.keyPrefix}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                        onClick={() => {
                          setRevokeKeyId(apiKey.id);
                          setRevokeDialogOpen(true);
                        }}
                        aria-label={`Revoke key ${apiKey.keyPrefix}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== Create API Key Dialog ========== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New API Key
            </DialogTitle>
            <DialogDescription>
              Select the scopes for this API key. The key will be shown only once after creation — copy it immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-3 block">Select Scopes</Label>
              <div className="space-y-3">
                {(['read_only', 'read_write', 'admin'] as ApiKeyScope[]).map((scope) => {
                  const badge = getScopeBadge(scope);
                  return (
                    <div key={scope} className="flex items-center gap-3">
                      <Checkbox
                        id={`scope-${scope}`}
                        checked={selectedScopes.includes(scope)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedScopes([...selectedScopes, scope]);
                          } else {
                            setSelectedScopes(selectedScopes.filter(s => s !== scope));
                          }
                        }}
                      />
                      <Label htmlFor={`scope-${scope}`} className="flex items-center gap-2 cursor-pointer">
                        <Badge className={badge.className}>{badge.label}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {scope === 'read_only' ? 'Can only read data' :
                           scope === 'read_write' ? 'Can read and modify data' :
                           'Full access including admin operations'}
                        </span>
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
              disabled={selectedScopes.length === 0 || createMutation.isPending}
              className="min-h-[44px]"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create API Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Show Key Dialog (shown ONCE after creation) ========== */}
      <Dialog open={showKeyDialogOpen} onOpenChange={setShowKeyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-1 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                This key will only be shown once! Copy it now and store it securely.
              </div>
            </DialogDescription>
          </DialogHeader>

          {newKeyResponse && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="mb-1 block">API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newKeyResponse.key}
                    readOnly
                    className="font-mono text-sm bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => copyToClipboard(newKeyResponse.key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Key prefix:</span>
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {newKeyResponse.keyPrefix}
                </code>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">Scopes:</span>
                {newKeyResponse.scopes.map((scope) => {
                  const badge = getScopeBadge(scope);
                  return (
                    <Badge key={scope} className={badge.className}>{badge.label}</Badge>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyDialogOpen(false);
                setNewKeyResponse(null);
              }}
              className="min-h-[44px]"
            >
              I&apos;ve Copied the Key — Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Revoke API Key Confirmation ========== */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke API Key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the API key. Any applications using this key will lose access instantly.
              <br /><br />
              <strong>This action cannot be undone.</strong> You would need to create a new key to replace it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={revokeMutation.isPending}
              className="min-h-[44px]"
              onClick={() => { setRevokeKeyId(''); }}
            >
              Keep Key
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Key'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========== Update Scopes Dialog ========== */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Update API Key Scopes
            </DialogTitle>
            <DialogDescription>
              Change the permission scopes for this API key. This will take effect immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-3 block">Select New Scopes</Label>
              <div className="space-y-3">
                {(['read_only', 'read_write', 'admin'] as ApiKeyScope[]).map((scope) => {
                  const badge = getScopeBadge(scope);
                  return (
                    <div key={scope} className="flex items-center gap-3">
                      <Checkbox
                        id={`update-scope-${scope}`}
                        checked={updateScopes.includes(scope)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setUpdateScopes([...updateScopes, scope]);
                          } else {
                            setUpdateScopes(updateScopes.filter(s => s !== scope));
                          }
                        }}
                      />
                      <Label htmlFor={`update-scope-${scope}`} className="flex items-center gap-2 cursor-pointer">
                        <Badge className={badge.className}>{badge.label}</Badge>
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
              onClick={() => { setUpdateDialogOpen(false); setUpdateKeyId(''); }}
              disabled={updateScopesMutation.isPending}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateScopes}
              disabled={updateScopes.length === 0 || updateScopesMutation.isPending}
              className="min-h-[44px]"
            >
              {updateScopesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Scopes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
