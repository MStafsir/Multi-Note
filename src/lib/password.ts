// ============================================================
// Password hashing utility using Web Crypto API
// ============================================================

// Simple hash function for password storage using SHA-256 + salt
// (In production, use bcrypt or argon2, but for SQLite demo this works)

const SALT_LENGTH = 16;

function generateSalt(): string {
  const array = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(message: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hash(password: string): Promise<string> {
  const salt = generateSalt();
  const hashed = await sha256(salt + password);
  return `${salt}:${hashed}`;
}

export async function compare(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  const hashed = await sha256(salt + password);
  return hashed === hash;
}
