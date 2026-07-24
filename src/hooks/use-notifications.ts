// ============================================================
// MODUL 20: Notification System — React Query Hooks
// 20.3: Real-time polling via refetchInterval
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// --- Query Keys ---
const NOTIFICATION_KEYS = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  preferences: ['notifications', 'preferences'] as const,
};

// --- Notification Types ---
export type NotificationType = 'share_received' | 'comment_added' | 'mention' | 'quota_warning' | 'monitoring_alert';
export type NotificationChannel = 'in_app' | 'email' | 'both' | 'off';

export interface NotificationEntry {
  id: string;
  recipientId: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPreferences {
  shareReceived: NotificationChannel;
  commentAdded: NotificationChannel;
  mention: NotificationChannel;
  quotaWarning: NotificationChannel;
}

// --- GET: Fetch notifications + unread count (20.3) ---
// Polling: refetch every 30 seconds for real-time updates
export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.list,
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      return {
        notifications: data.data.notifications as NotificationEntry[],
        unreadCount: data.data.unreadCount as number,
      };
    },
    staleTime: 10000,
    refetchInterval: 30000, // 20.3 — real-time polling
  });
}

// --- POST: Mark notifications as read (20.3) ---
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationIds, markAll }: { notificationIds?: string[]; markAll?: boolean }) => {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds, markAll }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.list });
    },
    onError: (error) => {
      toast.error(`Failed to mark notifications: ${error.message}`);
    },
  });
}

// --- GET: Fetch notification preferences (20.5) ---
export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.preferences,
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences');
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      return data.data.preferences as NotificationPreferences;
    },
    staleTime: 60000,
  });
}

// --- PUT: Update notification preferences (20.5) ---
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.preferences as NotificationPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.preferences });
      toast.success('Notification preferences updated');
    },
    onError: (error) => {
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });
}

export { NOTIFICATION_KEYS };
