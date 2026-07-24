// ============================================================
// MODUL 44: Webhook Dispatch — React Query Hooks
// 44.1 — GET list webhooks, POST create webhook
// 44.1 — PATCH update webhook, DELETE delete webhook
// 44.2 — GET delivery audit trail for a subscription
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { WebhookSubscriptionInfo, WebhookEventType, WebhookDeliveryInfo, WebhookDeliveryStatus } from '@/types';

// --- Query Keys ---
const WEBHOOK_KEYS = {
  all: ['webhooks'] as const,
  list: ['webhooks', 'list'] as const,
  detail: (id: string) => ['webhooks', 'detail', id] as const,
  deliveries: (subscriptionId: string, status?: WebhookDeliveryStatus) =>
    ['webhooks', 'deliveries', subscriptionId, status] as const,
};

// --- GET: List user's webhook subscriptions (44.1) ---
export function useWebhookSubscriptions() {
  return useQuery({
    queryKey: WEBHOOK_KEYS.list,
    queryFn: async () => {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as WebhookSubscriptionInfo[];
    },
    staleTime: 30000,
  });
}

// --- POST: Create webhook subscription (44.1) ---
export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { targetUrl: string; eventTypes: WebhookEventType[]; workspaceId?: string }) => {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // The response includes the full secret — only shown once at creation
      return data.data as WebhookSubscriptionInfo & { secret: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEBHOOK_KEYS.list });
      toast.success('Webhook created. Copy the signing secret now — it will only be shown once!');
    },
    onError: (error) => {
      toast.error(`Failed to create webhook: ${error.message}`);
    },
  });
}

// --- PATCH: Update webhook subscription (44.1) ---
export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, payload }: {
      subscriptionId: string;
      payload: { targetUrl?: string; eventTypes?: WebhookEventType[]; isActive?: boolean };
    }) => {
      const res = await fetch(`/api/webhooks/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as WebhookSubscriptionInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEBHOOK_KEYS.list });
      toast.success('Webhook updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update webhook: ${error.message}`);
    },
  });
}

// --- DELETE: Delete webhook subscription (44.1) ---
export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await fetch(`/api/webhooks/${subscriptionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEBHOOK_KEYS.list });
      toast.success('Webhook deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete webhook: ${error.message}`);
    },
  });
}

// --- GET: Webhook delivery audit trail (44.2) ---
export function useWebhookDeliveries(subscriptionId: string, statusFilter?: WebhookDeliveryStatus) {
  return useQuery({
    queryKey: WEBHOOK_KEYS.deliveries(subscriptionId, statusFilter),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/webhooks/${subscriptionId}/deliveries?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as {
        deliveries: WebhookDeliveryInfo[];
        pagination: { limit: number; offset: number; total: number; hasMore: boolean };
      };
    },
    enabled: !!subscriptionId,
    staleTime: 10000,
  });
}

export { WEBHOOK_KEYS };
