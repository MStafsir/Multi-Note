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

    // MODUL 36.1 — First registered user becomes admin
    const totalUsers = await db.user.count();
    const role = totalUsers === 0 ? 'admin' : 'user';

    // MODUL 49.14 — Wrap user+profile creation in explicit $transaction
    // Prevents orphaned user (User without Profile) if nested create partially fails.
    // Nested create is atomic within a single Prisma call, but explicit transaction
    // adds defense-in-depth for connection interruptions mid-operation.
    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name || null,
          passwordHash,
          profile: {
            create: {
              role,
              storageUsedBytes: BigInt(0),
              quotaLimitBytes: BigInt(5368709120), // 5GB
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      // MODUL 49.14 — Defensive check INSIDE transaction: verify profile was created
      // If profile creation silently fails, quota enforcement is bypassed
      const profileCheck = await tx.profile.findUnique({
        where: { userId: newUser.id },
      });
      if (!profileCheck) {
        // This should never happen with nested create, but if it does:
        logger.error('register_profile_missing_inside_tx', { userId: newUser.id }, null);
        await tx.profile.create({
          data: {
            userId: newUser.id,
            role,
            storageUsedBytes: BigInt(0),
            quotaLimitBytes: BigInt(5368709120),
          },
        });
      }

      return newUser;
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
