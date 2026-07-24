// ============================================================
// MODUL 42: Billing & Subscription — React Query Hooks
// 42.1 — GET subscription, POST create subscription
// 42.3 — PATCH cancel subscription (grace period aware)
// 42.4 — GET invoices for workspace
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { WorkspaceSubscriptionInfo, InvoiceInfo, SubscriptionStatus } from '@/types';

// --- Query Keys ---
const BILLING_KEYS = {
  subscription: (workspaceId: string) => ['billing', 'subscription', workspaceId] as const,
  invoices: (workspaceId: string) => ['billing', 'invoices', workspaceId] as const,
};

// --- GET: Fetch workspace subscription (42.1) ---
export function useWorkspaceSubscription(workspaceId: string) {
  return useQuery({
    queryKey: BILLING_KEYS.subscription(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/subscription`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as WorkspaceSubscriptionInfo | null;
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });
}

// --- GET: Fetch workspace invoices (42.4) ---
export function useWorkspaceInvoices(workspaceId: string) {
  return useQuery({
    queryKey: BILLING_KEYS.invoices(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/invoices`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as InvoiceInfo[];
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });
}

// --- POST: Create subscription (42.1) ---
export function useCreateSubscription(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { provider: 'stripe' | 'midtrans'; planTier: 'free' | 'pro' | 'enterprise' }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as WorkspaceSubscriptionInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.subscription(workspaceId) });
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.invoices(workspaceId) });
      toast.success('Subscription created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create subscription: ${error.message}`);
    },
  });
}

// --- PATCH: Cancel subscription (42.3 — cancelAtPeriodEnd) ---
// Note: In production this would call Stripe/Midtrans API.
// For now we simulate by updating the subscription directly.
export function useCancelSubscription(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // First get current subscription to find its ID
      const subRes = await fetch(`/api/workspaces/${workspaceId}/subscription`);
      const subData = await subRes.json();
      if (!subData.success) throw new Error(subData.error);
      if (!subData.data) throw new Error('No subscription found');

      // In a real implementation, this would call the billing provider's cancel API.
      // For our sandbox, we simulate by directly updating the subscription status.
      // The billing webhook handler (42.2) would receive the cancellation event
      // from the provider and set cancelAtPeriodEnd=true and status='canceled'.
      // Here we simulate that flow by calling the webhook endpoint.
      const res = await fetch(`/api/workspaces/${workspaceId}/subscription/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription.deleted',
          id: `cancel_${Date.now()}`,
          data: {
            object: {
              subscription_id: subData.data.providerSubscriptionId || subData.data.id,
              customer_id: subData.data.providerCustomerId || '',
              workspace_id: workspaceId,
            },
          },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.subscription(workspaceId) });
      toast.success('Subscription canceled. You will retain access until the end of the current billing period.');
    },
    onError: (error) => {
      toast.error(`Failed to cancel subscription: ${error.message}`);
    },
  });
}

export { BILLING_KEYS };
