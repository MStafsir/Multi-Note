// ============================================================
// MODUL 3: Registration API Route
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from '@/lib/password';
import { registerSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(validated.password);

    // Create user + profile
    const user = await db.user.create({
      data: {
        email: validated.email,
        name: validated.name || null,
        passwordHash,
        profile: {
          create: {
            storageUsedBytes: 0,
            quotaLimitBytes: 5368709120, // 5GB
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
