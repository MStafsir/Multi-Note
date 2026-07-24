// ============================================================
// Unit Tests — Password hashing utility
// Tests: hash format, compare success/failure
// ============================================================

import { describe, it, expect } from 'vitest';
import { hash, compare } from '@/lib/password';

describe('password utility', () => {
  it('hashes a password and produces salt:hash format', async () => {
    const hashed = await hash('mypassword123');
    expect(hashed).toContain(':');
    const parts = hashed.split(':');
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBe(32); // 16 bytes = 32 hex chars
  });

  it('produces different hashes for the same password', async () => {
    const hash1 = await hash('samepassword');
    const hash2 = await hash('samepassword');
    expect(hash1).not.toBe(hash2); // Different salts
  });

  it('compares correct password successfully', async () => {
    const hashed = await hash('correctpassword');
    const result = await compare('correctpassword', hashed);
    expect(result).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hashed = await hash('correctpassword');
    const result = await compare('wrongpassword', hashed);
    expect(result).toBe(false);
  });

  it('rejects empty password against any hash', async () => {
    const hashed = await hash('somepassword');
    const result = await compare('', hashed);
    expect(result).toBe(false);
  });

  it('handles special characters in password', async () => {
    const password = 'p@$$w0rd!#%^&*()';
    const hashed = await hash(password);
    const result = await compare(password, hashed);
    expect(result).toBe(true);
  });
});
