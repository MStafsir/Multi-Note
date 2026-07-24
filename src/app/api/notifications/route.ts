// ============================================================
// MODUL 20: Notification System API — GET (list) + POST (mark as read)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUnreadNotificationCount } from '@/lib/notification-sender';
import { z } from 'zod';

// GET /api/notifications — Get notifications for current user (20.3)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200);

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      getUnreadNotificationCount(userId),
    ]);

    // Parse payload JSON back to object
    const formattedNotifications = notifications.map(n => ({
      id: n.id,
      recipientId: n.recipientId,
      type: n.type,
      payload: n.payload ? JSON.parse(n.payload) : null,
      readAt: n.readAt,
      createdAt: n.createdAt,
      isRead: n.readAt !== null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        notifications: formattedNotifications,
        unreadCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Zod schema for marking notifications as read
const markReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

// POST /api/notifications — Mark notifications as read
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const validated = markReadSchema.parse(body);

    const now = new Date();

    if (validated.markAll) {
      // Set readAt = now() for all unread notifications for this user
      await db.notification.updateMany({
        where: {
          recipientId: userId,
          readAt: null,
        },
        data: { readAt: now },
      });
    } else if (validated.notificationIds && validated.notificationIds.length > 0) {
      // Set readAt = now() for specific IDs (only for this user's notifications)
      await db.notification.updateMany({
        where: {
          id: { in: validated.notificationIds },
          recipientId: userId,
        },
        data: { readAt: now },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide notificationIds or markAll=true' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark notifications as read';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
