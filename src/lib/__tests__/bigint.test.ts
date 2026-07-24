// ============================================================
// Unit Tests — BigInt serialization utility
// Tests: bigintToNumber conversion, serializeBigInt object handling
// ============================================================

import { describe, it, expect } from 'vitest';
import { bigintToNumber, serializeBigInt } from '@/lib/bigint';

describe('bigintToNumber', () => {
  it('converts BigInt to Number', () => {
    expect(bigintToNumber(BigInt(1024))).toBe(1024);
    expect(bigintToNumber(BigInt(5368709120))).toBe(5368709120);
  });

  it('returns Number as-is', () => {
    expect(bigintToNumber(42)).toBe(42);
    expect(bigintToNumber(0)).toBe(0);
  });

  it('returns null for null input', () => {
    expect(bigintToNumber(null)).toBe(null);
  });

  it('returns null for undefined input', () => {
    expect(bigintToNumber(undefined)).toBe(null);
  });
});

describe('serializeBigInt', () => {
  it('converts BigInt fields to Number in flat object', () => {
    const obj = { sizeBytes: BigInt(1024), name: 'test', id: '123' };
    const result = serializeBigInt(obj);
    expect(result.sizeBytes).toBe(1024);
    expect(result.name).toBe('test');
    expect(result.id).toBe('123');
  });

  it('converts BigInt in nested objects', () => {
    const obj = {
      metadata: { sizeBytes: BigInt(5368709120), mimeType: 'application/pdf' },
      id: 'node-1',
    };
    const result = serializeBigInt(obj);
    expect(result.metadata.sizeBytes).toBe(5368709120);
    expect(result.metadata.mimeType).toBe('application/pdf');
  });

  it('preserves null and non-BigInt values', () => {
    const obj = { value: null, count: 5, flag: true };
    const result = serializeBigInt(obj);
    expect(result.value).toBe(null);
    expect(result.count).toBe(5);
    expect(result.flag).toBe(true);
  });

  it('preserves arrays without converting them', () => {
    const obj = { items: [1, 2, 3], sizeBytes: BigInt(100) };
    const result = serializeBigInt(obj);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.sizeBytes).toBe(100);
  });
});
