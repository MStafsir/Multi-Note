// ============================================================
// MODUL 13: User Lookup API — Resolve email to userId for sharing
// GET /api/users/lookup?email=xxx — Find user by email
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email parameter required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Don't return self
    if (user.id === session.user.id) {
      return NextResponse.json({ success: false, error: 'Cannot share with yourself' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to lookup user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
