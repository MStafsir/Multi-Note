// ============================================================
// MODUL 20: Shared Notification Helper
// Creates in-app notifications + checks preferences for email
// ============================================================

import { db } from '@/lib/db';

type NotificationType = 'share_received' | 'comment_added' | 'mention' | 'quota_warning';

interface CreateNotificationParams {
  recipientId: string;
  type: NotificationType;
  payload?: Record<string, unknown>;
}

export async function createNotification({ recipientId, type, payload }: CreateNotificationParams): Promise<void> {
  // Check user preference for this notification type
  const preference = await db.notificationPreference.findUnique({
    where: { userId: recipientId },
  });

  const prefValue = preference?.[type as keyof typeof preference] as string | undefined;

  // If preference is 'off', skip notification entirely
  if (prefValue === 'off') return;

  // Create in-app notification (unless preference is 'email' only)
  if (prefValue !== 'email') {
    await db.notification.create({
      data: {
        recipientId,
        type,
        payload: payload ? JSON.stringify(payload) : null,
      },
    });
  }

  // For 'email' or 'both' preferences, we'd send email via external service
  // Currently just log it — email integration would use Resend/SMTP in production
  if (prefValue === 'email' || prefValue === 'both') {
    // TODO: Integrate with email service (Resend, SMTP, etc.)
    console.log(`[notification] Email notification for ${recipientId}: ${type}`);
  }
}

// Get unread notification count for a user
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({
    where: {
      recipientId: userId,
      readAt: null,
    },
  });
}
