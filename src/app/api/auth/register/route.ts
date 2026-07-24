// ============================================================
// MODUL 3: Registration API Route
// MODUL 27: Added traceHandler wrapper & structured logging
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from '@/lib/password';
import { registerSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';

async function handleRegister(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      logger.info('register_duplicate_email', { email: validated.email }, null);
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

    logger.info('register_success', { user_id: user.id, email: user.email }, user.id);

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error: unknown) {
    logger.error('register_failed', {}, error);
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

export const POST = traceHandler(handleRegister);
