// ============================================================
// MODUL 27: Alert Monitor — Tracks error rates and latency
// 5-minute rolling window for error rate calculation
// Auto-creates Notification when error-rate > 1% or p99 > 1s
// Checks every 30 seconds using setInterval
// ============================================================

import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

interface MetricEntry {
  timestamp: number; // ms epoch
  durationMs: number;
  isError: boolean;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const ERROR_RATE_THRESHOLD = 0.01; // 1%
const P99_LATENCY_THRESHOLD_MS = 1000; // 1s

class AlertMonitor {
  private metrics: MetricEntry[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastAlertTime: number = 0;
  private lastAlertType: string = '';
  private alertCooldownMs = 5 * 60 * 1000; // Don't repeat same alert within 5 min

  constructor() {
    // Start periodic check
    this.startMonitoring();
  }

  /**
   * Record a request metric
   */
  recordRequest(durationMs: number, isError: boolean): void {
    this.metrics.push({
      timestamp: Date.now(),
      durationMs,
      isError,
    });

    // Prune old entries outside the 5-minute window
    const cutoff = Date.now() - FIVE_MINUTES_MS;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Start periodic monitoring checks
   */
  private startMonitoring(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAlerts().catch((err: unknown) => {
        logger.error('alert_check_failed', {}, err);
      });
    }, CHECK_INTERVAL_MS);

    // Don't let the interval prevent the process from exiting in production
    if (this.checkInterval && typeof this.checkInterval === 'object' && 'unref' in this.checkInterval) {
      this.checkInterval.unref();
    }
  }

  /**
   * Check if alert thresholds are breached and create notifications
   */
  private async checkAlerts(): Promise<void> {
    const cutoff = Date.now() - FIVE_MINUTES_MS;
    const windowMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    if (windowMetrics.length === 0) return;

    // Calculate error rate
    const errorCount = windowMetrics.filter(m => m.isError).length;
    const errorRate = errorCount / windowMetrics.length;

    // Calculate p99 latency
    const latencies = windowMetrics.map(m => m.durationMs).sort((a, b) => a - b);
    const p99Index = Math.ceil(latencies.length * 0.99) - 1;
    const p99Latency = latencies[p99Index] ?? 0;

    // Check thresholds
    const errorRateBreached = errorRate > ERROR_RATE_THRESHOLD;
    const p99LatencyBreached = p99Latency > P99_LATENCY_THRESHOLD_MS;

    if (errorRateBreached) {
      const alertType = 'error_rate';
      if (this.canSendAlert(alertType)) {
        logger.warn('alert_threshold_breached', {
          type: 'error_rate',
          error_rate: errorRate,
          error_count: errorCount,
          total_requests: windowMetrics.length,
          threshold: ERROR_RATE_THRESHOLD,
          window_minutes: 5,
        });

        // Create in-app notification for admin (first registered user)
        await this.createAdminNotification('error_rate', {
          error_rate: errorRate,
          error_count: errorCount,
          total_requests: windowMetrics.length,
          threshold: ERROR_RATE_THRESHOLD,
          window_minutes: 5,
        });

        this.lastAlertTime = Date.now();
        this.lastAlertType = alertType;
      }
    }

    if (p99LatencyBreached) {
      const alertType = 'p99_latency';
      if (this.canSendAlert(alertType)) {
        logger.warn('alert_threshold_breached', {
          type: 'p99_latency',
          p99_latency_ms: Math.round(p99Latency),
          threshold_ms: P99_LATENCY_THRESHOLD_MS,
          total_requests: windowMetrics.length,
          window_minutes: 5,
        });

        // Create in-app notification for admin (first registered user)
        await this.createAdminNotification('p99_latency', {
          p99_latency_ms: Math.round(p99Latency),
          threshold_ms: P99_LATENCY_THRESHOLD_MS,
          total_requests: windowMetrics.length,
          window_minutes: 5,
        });

        this.lastAlertTime = Date.now();
        this.lastAlertType = alertType;
      }
    }

    // Prune again after check
    const newCutoff = Date.now() - FIVE_MINUTES_MS;
    this.metrics = this.metrics.filter(m => m.timestamp >= newCutoff);
  }

  /**
   * Create a monitoring_alert notification for the admin user (first registered)
   */
  private async createAdminNotification(alertType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      // Find admin (first registered user)
      const admin = await db.user.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (!admin) return;

      await db.notification.create({
        data: {
          recipientId: admin.id,
          type: 'monitoring_alert',
          payload: JSON.stringify({
            alertType,
            ...payload,
            triggeredAt: new Date().toISOString(),
          }),
        },
      });

      logger.info('admin_alert_notification_created', { alertType, adminId: admin.id }, admin.id);
    } catch (error: unknown) {
      logger.error('admin_alert_notification_failed', { alertType }, error);
    }
  }

  /**
   * Check if we can send an alert (cooldown prevents duplicate alerts)
   */
  private canSendAlert(alertType: string): boolean {
    const now = Date.now();
    if (alertType === this.lastAlertType && (now - this.lastAlertTime) < this.alertCooldownMs) {
      return false;
    }
    return true;
  }

  /**
   * Get current metrics summary (for admin dashboard)
   */
  getMetricsSummary(): {
    errorRate: number;
    errorCount: number;
    requestCount: number;
    p99LatencyMs: number;
    p50LatencyMs: number;
    avgLatencyMs: number;
    windowMinutes: number;
  } {
    const cutoff = Date.now() - FIVE_MINUTES_MS;
    const windowMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    if (windowMetrics.length === 0) {
      return {
        errorRate: 0,
        errorCount: 0,
        requestCount: 0,
        p99LatencyMs: 0,
        p50LatencyMs: 0,
        avgLatencyMs: 0,
        windowMinutes: 5,
      };
    }

    const errorCount = windowMetrics.filter(m => m.isError).length;
    const latencies = windowMetrics.map(m => m.durationMs).sort((a, b) => a - b);
    const p99Index = Math.ceil(latencies.length * 0.99) - 1;
    const p50Index = Math.ceil(latencies.length * 0.5) - 1;
    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    return {
      errorRate: errorCount / windowMetrics.length,
      errorCount,
      requestCount: windowMetrics.length,
      p99LatencyMs: Math.round(latencies[Math.max(0, p99Index)] ?? 0),
      p50LatencyMs: Math.round(latencies[Math.max(0, p50Index)] ?? 0),
      avgLatencyMs: Math.round(avg),
      windowMinutes: 5,
    };
  }

  /**
   * Stop monitoring (for cleanup)
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Singleton instance
export const alertMonitor = new AlertMonitor();
