// ============================================================
// Cache Manager — Generic directory-based cache for converted files
// Uses a simple directory-based cache with:
// - Cache directory: <projectRoot>/cache/lo-pdf/
// - Files named: <checksumSha256>.pdf
// - Cleanup of old entries based on file modification time
// - Startup cleanup on module load
// ============================================================

import path from 'path';
import fs from 'fs';
import { stat, readdir, unlink } from 'fs/promises';

const CACHE_DIR = path.join(process.cwd(), 'cache', 'lo-pdf');

/** Default max age for cache entries: 7 days in milliseconds */
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ensure the cache directory exists. Creates it recursively if needed.
 */
export function ensureCacheDir(): string {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  return CACHE_DIR;
}

/**
 * Get the full path for a cached PDF file based on its checksum.
 * Returns the path regardless of whether the file exists.
 */
export function getCacheFilePath(checksumSha256: string): string {
  return path.join(CACHE_DIR, `${checksumSha256}.pdf`);
}

/**
 * Check if a cached PDF exists for the given checksum.
 * Returns the path if it exists, null otherwise.
 */
export function getCachedPdfPath(checksumSha256: string): string | null {
  if (!checksumSha256) return null;

  const filePath = getCacheFilePath(checksumSha256);
  try {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  } catch {
    // Ignore errors (permissions, etc.)
  }
  return null;
}

/**
 * Get the size of a cached PDF file in bytes.
 * Returns 0 if the file doesn't exist.
 */
export async function getCachedPdfSize(checksumSha256: string): Promise<number> {
  const filePath = getCacheFilePath(checksumSha256);
  try {
    const fileStat = await stat(filePath);
    return fileStat.size;
  } catch {
    return 0;
  }
}

/**
 * Remove old cache entries based on file modification time.
 * Entries older than maxAgeMs are deleted.
 * Default maxAgeMs is 7 days.
 */
export async function cleanupOldCache(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<number> {
  const dir = ensureCacheDir();
  const now = Date.now();
  let deletedCount = 0;

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      // Only process .pdf files
      if (!entry.endsWith('.pdf')) continue;

      const filePath = path.join(dir, entry);
      try {
        const fileStat = await stat(filePath);
        const fileAge = now - fileStat.mtimeMs;

        if (fileAge > maxAgeMs) {
          await unlink(filePath);
          deletedCount++;
        }
      } catch {
        // File may have been deleted already, skip
      }
    }
  } catch (error) {
    console.error('[cache-manager] Failed to cleanup cache directory:', error);
  }

  return deletedCount;
}

/**
 * Get the total size of all cached PDF files in bytes.
 */
export async function getCacheTotalSize(): Promise<number> {
  const dir = ensureCacheDir();
  let totalSize = 0;

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      if (!entry.endsWith('.pdf')) continue;

      const filePath = path.join(dir, entry);
      try {
        const fileStat = await stat(filePath);
        totalSize += fileStat.size;
      } catch {
        // Skip files that can't be stat'd
      }
    }
  } catch {
    // Directory may not exist yet
  }

  return totalSize;
}

/**
 * Get the number of cached PDF files.
 */
export async function getCacheEntryCount(): Promise<number> {
  const dir = ensureCacheDir();
  let count = 0;

  try {
    const entries = await readdir(dir);
    count = entries.filter((e) => e.endsWith('.pdf')).length;
  } catch {
    // Directory may not exist yet
  }

  return count;
}

/**
 * Delete a specific cached PDF by checksum.
 */
export async function deleteCachedPdf(checksumSha256: string): Promise<boolean> {
  const filePath = getCacheFilePath(checksumSha256);
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Startup cleanup: run once when the module is loaded
// Removes cache entries older than 7 days
// ============================================================
cleanupOldCache().then((deleted) => {
  if (deleted > 0) {
    console.info(`[cache-manager] Startup cleanup: removed ${deleted} old cache entries`);
  }
}).catch((err) => {
  console.error('[cache-manager] Startup cleanup failed:', err);
});
