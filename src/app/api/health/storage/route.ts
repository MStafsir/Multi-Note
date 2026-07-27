// ============================================================
// MODUL 49.16: Storage Health-Check API Endpoint
// Returns current storage mount status and alert level.
// Admin-only: requires x-user-role=admin header from middleware.
// ============================================================

import { NextResponse } from 'next/server';
import { checkStorageHealth } from '@/lib/storage-health';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only endpoint — storage health is infrastructure info
  const userRole = request.headers.get('x-user-role');
  if (userRole !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden — Admin access required' }, { status: 403 });
  }

  const health = await checkStorageHealth();

  logger.info('storage_health_endpoint', {
    mountType: health.mountType,
    alertLevel: health.alertLevel,
    writable: health.writable,
  }, userId);

  const statusCode = health.alertLevel === 'critical' ? 503 : 200;

  return NextResponse.json({
    success: true,
    data: {
      mountType: health.mountType,
      isOssMount: health.isOssMount,
      isTmpfsFallback: health.isTmpfsFallback,
      writable: health.writable,
      alertLevel: health.alertLevel,
      message: health.message,
      timestamp: new Date().toISOString(),
      // MODUL 49.16 reminder: OSS is Z.ai-owned, not user-owned.
      // For personal deployment (Vercel+Supabase), migrate to
      // user-owned storage (Supabase Storage, R2, S3) before
      // enabling Google OAuth (49.15) with public Gmail accounts.
      migrationRequired: health.isTmpfsFallback || (!health.isOssMount && health.mountType === 'local'),
    },
  }, { status: statusCode });
}
