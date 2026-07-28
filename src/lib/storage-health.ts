// ============================================================
// MODUL 49.16: OSS Storage Health-Check
// Fails-loud if ossfs mount is down and tmpfs is the active
// fallback. Alerts via structured logging (not silent).
//
// IMPORTANT: OSS storage is Z.ai-owned infrastructure, NOT
// user-owned. For production deployment to personal Vercel+Supabase,
// migrate to user-owned storage (Supabase Storage, Cloudflare R2,
// or AWS S3) BEFORE enabling public Gmail accounts (49.15).
// ============================================================

import { logger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const HEALTH_CHECK_MARKER = '.oss-health-check';

interface StorageHealthResult {
  isOssMount: boolean;
  isTmpfsFallback: boolean;
  mountType: 'ossfs' | 'tmpfs' | 'local' | 'unknown';
  writable: boolean;
  alertLevel: 'ok' | 'warning' | 'critical';
  message: string;
}

/**
 * Check the health of the upload storage mount.
 * Detects whether ossfs (Alibaba Cloud OSS via FUSE) or tmpfs
 * (local RAM disk fallback) is the active mount.
 *
 * Fails-loud: If ossfs is down and tmpfs is active, this is logged
 * as a CRITICAL alert. tmpfs is volatile — files stored on tmpfs
 * will be lost on container restart.
 */
export async function checkStorageHealth(): Promise<StorageHealthResult> {
  // Step 1: Check if upload directory exists and is writable
  let writable = false;
  try {
    await fs.access(UPLOAD_DIR, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }

  // Step 2: Determine mount type by reading /proc/mounts
  let mountType: 'ossfs' | 'tmpfs' | 'local' | 'unknown' = 'unknown';
  try {
    const mountsData = await fs.readFile('/proc/mounts', 'utf-8');
    const mountLines = mountsData.split('\n');

    // Find the last mount on the upload directory (most specific)
    // Both tmpfs and ossfs may be mounted on the same path; the last
    // one in the list is the active mount
    const uploadMounts = mountLines.filter(line =>
      line.includes(' ' + UPLOAD_DIR + ' ') ||
      line.split(' ')[1] === UPLOAD_DIR
    );

    if (uploadMounts.length > 0) {
      const lastMount = uploadMounts[uploadMounts.length - 1];
      const mountFsType = lastMount.split(' ')[2];

      if (mountFsType === 'fuse.ossfs' || mountFsType === 'ossfs') {
        mountType = 'ossfs';
      } else if (mountFsType === 'tmpfs') {
        mountType = 'tmpfs';
      } else {
        mountType = 'local';
      }
    }
  } catch {
    // Can't read /proc/mounts — assume local filesystem
    mountType = 'local';
  }

  // Step 3: Verify OSS functionality by writing and reading a test file
  let ossFunctional = false;
  if (mountType === 'ossfs' && writable) {
    try {
      const testPath = path.join(UPLOAD_DIR, HEALTH_CHECK_MARKER);
      const testContent = `oss-health-check:${Date.now()}`;
      await fs.writeFile(testPath, testContent, 'utf-8');
      const readBack = await fs.readFile(testPath, 'utf-8');
      ossFunctional = readBack === testContent;
      // Clean up test file
      await fs.unlink(testPath).catch(() => {});
    } catch {
      ossFunctional = false;
    }
  }

  // Step 4: Determine alert level
  const isOssMount = mountType === 'ossfs' && ossFunctional;
  const isTmpfsFallback = mountType === 'tmpfs';

  let alertLevel: 'ok' | 'warning' | 'critical' = 'ok';
  let message = '';

  if (isOssMount) {
    alertLevel = 'ok';
    message = 'OSS storage mount is active and functional';
  } else if (isTmpfsFallback) {
    alertLevel = 'critical';
    message = 'CRITICAL: OSS mount is DOWN — tmpfs fallback is active. Files stored on tmpfs are volatile and will be lost on container restart. This is NOT suitable for production use.';
    logger.error('storage_health_critical', {
      mountType,
      writable,
      message: 'OSS mount down — tmpfs fallback active — data loss risk on restart',
    }, null);
  } else if (mountType === 'ossfs' && !ossFunctional) {
    alertLevel = 'warning';
    message = 'WARNING: OSS mount appears mounted but is NOT functional (write/read test failed). Storage may be degraded.';
    logger.warn('storage_health_warning', {
      mountType,
      writable,
      message: 'OSS mount present but write/read test failed',
    }, null);
  } else if (mountType === 'local') {
    alertLevel = 'warning';
    message = 'WARNING: Upload directory is on local filesystem (not OSS or tmpfs). Persistence depends on container lifecycle.';
    logger.warn('storage_health_local', {
      mountType,
      writable,
      message: 'Upload on local filesystem — persistence depends on container',
    }, null);
  } else {
    alertLevel = 'warning';
    message = `Unknown storage mount type: ${mountType}`;
  }

  return {
    isOssMount,
    isTmpfsFallback,
    mountType,
    writable,
    alertLevel,
    message,
  };
}

/**
 * Run a storage health-check on a schedule (e.g., every 5 minutes).
 * Returns the result but also logs critical/warning alerts.
 */
export async function runStorageHealthCheckSchedule(): Promise<StorageHealthResult> {
  const result = await checkStorageHealth();

  if (result.alertLevel === 'critical') {
    // Already logged in checkStorageHealth, but also emit a structured metric
    logger.error('storage_health_check_schedule', {
      alertLevel: result.alertLevel,
      mountType: result.mountType,
      writable: result.writable,
      message: result.message,
    }, null);
  } else if (result.alertLevel === 'warning') {
    logger.warn('storage_health_check_schedule', {
      alertLevel: result.alertLevel,
      mountType: result.mountType,
      writable: result.writable,
      message: result.message,
    }, null);
  } else {
    logger.info('storage_health_check_ok', {
      mountType: result.mountType,
      writable: result.writable,
    }, null);
  }

  return result;
}
