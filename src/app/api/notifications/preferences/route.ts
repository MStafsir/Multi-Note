// ============================================================
// MODUL 20.5: Notification Preferences API — GET + PUT
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const channelSchema = z.enum(['in_app', 'email', 'both', 'off']);

const preferencesUpdateSchema = z.object({
  shareReceived: channelSchema.optional(),
  commentAdded: channelSchema.optional(),
  mention: channelSchema.optional(),
  quotaWarning: channelSchema.optional(),
});

// GET /api/notifications/preferences — Get notification preferences for current user
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    let preference = await db.notificationPreference.findUnique({
      where: { userId },
    });

    // If no preference row exists, create one with defaults
    if (!preference) {
      preference = await db.notificationPreference.create({
        data: { userId },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        preferences: {
          shareReceived: preference.shareReceived,
          commentAdded: preference.commentAdded,
          mention: preference.mention,
          quotaWarning: preference.quotaWarning,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notification preferences';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/notifications/preferences — Update notification preferences
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const validated = preferencesUpdateSchema.parse(body);

    // Upsert the preference row
    const preference = await db.notificationPreference.upsert({
      where: { userId },
      update: validated,
      create: {
        userId,
        ...validated,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        preferences: {
          shareReceived: preference.shareReceived,
          commentAdded: preference.commentAdded,
          mention: preference.mention,
          quotaWarning: preference.quotaWarning,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update notification preferences';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
