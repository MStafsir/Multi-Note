import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

/**
 * Resolve a storagePath from the database to an absolute filesystem path.
 * Handles three formats:
 * 1. Absolute path (starts with '/') → use as-is
 * 2. Relative path with 'upload/' prefix → strip prefix, join with UPLOAD_DIR
 * 3. Relative path without prefix → join directly with UPLOAD_DIR
 */
export function resolveStoragePath(storagePath: string): string {
  // 1. Absolute path → use as-is
  if (storagePath.startsWith('/')) {
    return storagePath;
  }

  // 2. Relative path with 'upload/' prefix → strip it, then join with UPLOAD_DIR
  if (storagePath.startsWith('upload/') || storagePath.startsWith('upload\\')) {
    const stripped = storagePath.replace(/^upload[\\/]/, '');
    return path.join(UPLOAD_DIR, stripped);
  }

  // 3. Relative path without prefix → join directly with UPLOAD_DIR
  return path.join(UPLOAD_DIR, storagePath);
}
