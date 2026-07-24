// ============================================================
// MODUL 43: API Key Management — React Query Hooks
// 43.1 — GET list API keys, POST create API key
// 43.5 — DELETE revoke API key, PATCH update scopes
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ApiKeyInfo, ApiKeyCreateResponse, ApiKeyScope } from '@/types';

// --- Query Keys ---
const API_KEY_KEYS = {
  all: ['api-keys'] as const,
  list: ['api-keys', 'list'] as const,
};

// --- GET: List user's API keys (43.1) ---
export function useApiKeys() {
  return useQuery({
    queryKey: API_KEY_KEYS.list,
    queryFn: async () => {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as ApiKeyInfo[];
    },
    staleTime: 30000,
  });
}

// --- POST: Create new API key (43.1) ---
// Returns ApiKeyCreateResponse which includes plaintext key (shown once)
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { scopes: ApiKeyScope[]; workspaceId?: string }) => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as ApiKeyCreateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.list });
      toast.success('API key created. Copy the key now — it will only be shown once!');
    },
    onError: (error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });
}

// --- DELETE: Revoke API key (43.5 — immediate invalidation) ---
export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (apiKeyId: string) => {
      const res = await fetch(`/api/api-keys/${apiKeyId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as ApiKeyInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.list });
      toast.success('API key revoked successfully');
    },
    onError: (error) => {
      toast.error(`Failed to revoke API key: ${error.message}`);
    },
  });
}

// --- PATCH: Update API key scopes (43.5) ---
export function useUpdateApiKeyScopes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ apiKeyId, scopes }: { apiKeyId: string; scopes: ApiKeyScope[] }) => {
      const res = await fetch(`/api/api-keys/${apiKeyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as ApiKeyInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.list });
      toast.success('API key scopes updated');
    },
    onError: (error) => {
      toast.error(`Failed to update API key scopes: ${error.message}`);
    },
  });
}

export { API_KEY_KEYS };
