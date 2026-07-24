// ============================================================
// Integration Tests — Auth API Routes
// Tests: register → verify user created,
//        register duplicate email → error
// Uses real database (SQLite) via Prisma
// ============================================================

import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { hash } from '@/lib/password';
import { cleanupTestData } from '@/test/db-setup';

describe('Auth — Integration Tests', () => {
  const testEmails: string[] = [];

  afterEach(async () => {
    // Clean up all test users
    for (const email of testEmails) {
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        await cleanupTestData(user.id);
      }
    }
    testEmails.length = 0;
  });

  // --- Register ---
  describe('Register user — database verification', () => {
    it('creates a new user and verifies in database', async () => {
      const email = `register-test-${Date.now()}@example.com`;
      testEmails.push(email);

      const passwordHash = await hash('securepassword123');
      const user = await db.user.create({
        data: {
          email,
          name: 'Register Test User',
          passwordHash,
          profile: {
            create: {
              storageUsedBytes: 0,
              quotaLimitBytes: 5368709120,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      // Verify user created
      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.name).toBe('Register Test User');

      // Verify user exists in database
      const found = await db.user.findUnique({ where: { email } });
      expect(found).not.toBeNull();
      expect(found!.email).toBe(email);
      expect(found!.passwordHash).toBeDefined();
      expect(found!.passwordHash!.length).toBeGreaterThan(0);

      // Verify profile created
      const profile = await db.profile.findUnique({ where: { userId: user.id } });
      expect(profile).not.toBeNull();
      expect(Number(profile!.storageUsedBytes)).toBe(0);
      expect(Number(profile!.quotaLimitBytes)).toBe(5368709120); // 5GB
    });

    it('rejects duplicate email registration — unique constraint', async () => {
      const email = `duplicate-test-${Date.now()}@example.com`;
      testEmails.push(email);

      const passwordHash = await hash('password123');

      // Create first user
      await db.user.create({
        data: {
          email,
          name: 'First User',
          passwordHash,
          profile: { create: { storageUsedBytes: 0, quotaLimitBytes: 5368709120 } },
        },
      });

      // Attempt to create second user with same email — should fail
      await expect(
        db.user.create({
          data: {
            email,
            name: 'Second User',
            passwordHash,
            profile: { create: { storageUsedBytes: 0, quotaLimitBytes: 5368709120 } },
          },
        })
      ).rejects.toThrow();

      // Verify only one user exists
      const users = await db.user.findMany({ where: { email } });
      expect(users.length).toBe(1);
    });
  });

  // --- Password Verification ---
  describe('Password hashing and comparison', () => {
    it('hashes password and verifies correctly', async () => {
      const originalPassword = 'testpassword123';
      const hashedPassword = await hash(originalPassword);

      // Hash should be different from original
      expect(hashedPassword).not.toBe(originalPassword);

      // Hash should contain salt:hash format
      expect(hashedPassword).toContain(':');

      // Comparison should succeed
      const { compare } = await import('@/lib/password');
      const isValid = await compare(originalPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('rejects wrong password', async () => {
      const originalPassword = 'correctpassword';
      const hashedPassword = await hash(originalPassword);

      const { compare } = await import('@/lib/password');
      const isValid = await compare('wrongpassword', hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  // --- Session / Auth Validation ---
  describe('Register schema validation via database constraints', () => {
    it('prevents creating user with empty email via schema', async () => {
      const { registerSchema } = await import('@/lib/validators');
      const result = registerSchema.safeParse({
        email: '',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('prevents creating user with short password via schema', async () => {
      const { registerSchema } = await import('@/lib/validators');
      const result = registerSchema.safeParse({
        email: 'valid@example.com',
        password: 'abc',
      });
      expect(result.success).toBe(false);
    });
  });
});
