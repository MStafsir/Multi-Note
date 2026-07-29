import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

/**
 * Resolve a storagePath from the database to an absolute filesystem path.
 * Handles multiple formats:
 * 1. Absolute path (starts with '/') → use as-is
 * 2. Relative path with 'upload/' prefix → strip prefix, join with UPLOAD_DIR
 *    (e.g., "upload/{userId}/{uuid}-{name}" → UPLOAD_DIR/{userId}/{uuid}-{name})
 * 3. Relative path without prefix → join directly with UPLOAD_DIR
 *    (e.g., "user-files/{userId}/file-..." → UPLOAD_DIR/user-files/{userId}/file-...)
 *
 * NOTE: The 'user-files/' prefix is handled by case 3 (no stripping needed)
 * because 'user-files/' is a real subdirectory inside the upload directory.
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
  // This handles 'user-files/' prefix and other legacy formats correctly
  // because 'user-files/' is a real subdirectory inside the upload directory.
  return path.join(UPLOAD_DIR, storagePath);
}

/**
 * Get the UPLOAD_DIR constant for use in other modules.
 */
export function getUploadDir(): string {
  return UPLOAD_DIR;
}
