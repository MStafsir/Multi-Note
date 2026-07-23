// ============================================================
// BigInt Serialization Helper
// Prisma BigInt fields must be converted to Number for JSON
// ============================================================

/**
 * Convert BigInt values to Number for JSON serialization.
 * Prisma returns BigInt for BigInt columns, which JSON.stringify can't handle.
 */
export function bigintToNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return Number(value);
}

/**
 * Convert BigInt fields in an object to Number for JSON serialization.
 */
export function serializeBigInt<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      result[key] = Number(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeBigInt(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
