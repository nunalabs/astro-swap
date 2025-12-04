/**
 * Monitoring Module
 *
 * Production-grade monitoring for AstroSwap Indexer
 * Implements: Sentry Error Tracking, Metrics, Health Checks
 *
 * @module monitoring
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler, Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface MonitoringConfig {
  sentry: {
    enabled: boolean;
    dsn: string;
    environment: string;
    release?: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
  };
  healthCheck: {
    enabled: boolean;
    interval: number;
  };
  metrics: {
    enabled: boolean;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    redis?: ComponentHealth;
    stellar?: ComponentHealth;
  };
  metrics?: SystemMetrics;
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  requests: {
    total: number;
    perMinute: number;
    errors: number;
    errorRate: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultMonitoringConfig: MonitoringConfig = {
  sentry: {
    enabled: !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  },
  healthCheck: {
    enabled: true,
    interval: 30000, // 30 seconds
  },
  metrics: {
    enabled: true,
  },
};

// ============================================================================
// Metrics Collector
// ============================================================================

class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private requestsPerMinute: number[] = [];
  private startTime = Date.now();

  incrementRequests(): void {
    this.requestCount++;
    this.requestsPerMinute.push(Date.now());

    // Keep only last minute of data
    const oneMinuteAgo = Date.now() - 60000;
    this.requestsPerMinute = this.requestsPerMinute.filter((t) => t > oneMinuteAgo);
  }

  incrementErrors(): void {
    this.errorCount++;
  }

  getMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: {
        usage: Math.round(process.cpuUsage().user / 1000000),
      },
      requests: {
        total: this.requestCount,
        perMinute: this.requestsPerMinute.length,
        errors: this.errorCount,
        errorRate:
          this.requestCount > 0
            ? Math.round((this.errorCount / this.requestCount) * 100 * 100) / 100
            : 0,
      },
    };
  }

  getUptime(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }
}

const metricsCollector = new MetricsCollector();

// ============================================================================
// Sentry Setup
// ============================================================================

export function initSentry(_app: Express, config: MonitoringConfig): void {
  if (!config.sentry.enabled || !config.sentry.dsn) {
    logger.info('Sentry disabled or DSN not provided');
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.sentry.release,
    tracesSampleRate: config.sentry.tracesSampleRate,
    profilesSampleRate: config.sentry.profilesSampleRate,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.prismaIntegration(),
    ],
    beforeSend(event) {
      // Don't send events in development
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      return event;
    },
  });

  logger.info(
    { environment: config.sentry.environment },
    'Sentry initialized'
  );
}

// ============================================================================
// Sentry Middleware
// ============================================================================

export function sentryRequestHandler(): RequestHandler {
  return (_req, _res, next) => next();
}

export function sentryErrorHandler(): ErrorRequestHandler {
  return (err: Error, _req: Request, _res: Response, next: NextFunction) => {
    Sentry.captureException(err);
    next(err);
  };
}

// ============================================================================
// Request Tracking Middleware
// ============================================================================

export function requestTracker(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    metricsCollector.incrementRequests();

    // Track response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log request
      logger.info({
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }, 'Request completed');

      // Track errors
      if (statusCode >= 400) {
        metricsCollector.incrementErrors();
      }

      // Report slow requests
      if (duration > 5000) {
        logger.warn({
          method: req.method,
          path: req.path,
          duration,
        }, 'Slow request detected');

        Sentry.captureMessage(`Slow request: ${req.method} ${req.path}`, {
          level: 'warning',
          extra: { duration, statusCode },
        });
      }
    });

    next();
  };
}

// ============================================================================
// Health Check
// ============================================================================

export class HealthChecker {
  private prisma: PrismaClient;
  private redisClient?: any;
  private stellarRpcUrl?: string;

  constructor(
    prisma: PrismaClient,
    options?: { redis?: any; stellarRpcUrl?: string }
  ) {
    this.prisma = prisma;
    this.redisClient = options?.redis;
    this.stellarRpcUrl = options?.stellarRpcUrl;
  }

  async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkRedis(): Promise<ComponentHealth | undefined> {
    if (!this.redisClient) {
      return undefined;
    }

    const start = Date.now();
    try {
      await this.redisClient.ping();
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkStellar(): Promise<ComponentHealth | undefined> {
    if (!this.stellarRpcUrl) {
      return undefined;
    }

    const start = Date.now();
    try {
      const response = await fetch(`${this.stellarRpcUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return {
        status: response.ok ? 'up' : 'degraded',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getHealth(): Promise<HealthStatus> {
    const [database, redis, stellar] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStellar(),
    ]);

    const checks = {
      database,
      ...(redis && { redis }),
      ...(stellar && { stellar }),
    };

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (database.status === 'down') {
      status = 'unhealthy';
    } else if (
      database.status === 'degraded' ||
      redis?.status === 'down' ||
      stellar?.status === 'down'
    ) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: metricsCollector.getUptime(),
      version: process.env.APP_VERSION || '1.0.0',
      checks,
      metrics: metricsCollector.getMetrics(),
    };
  }
}

// ============================================================================
// Health Check Endpoint Handler
// ============================================================================

export function createHealthEndpoint(healthChecker: HealthChecker): RequestHandler {
  return async (_req: Request, res: Response) => {
    try {
      const health = await healthChecker.getHealth();

      const statusCode =
        health.status === 'healthy' ? 200 :
        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error({ error }, 'Health check failed');

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

// ============================================================================
// Readiness & Liveness Probes (Kubernetes)
// ============================================================================

export function createReadinessProbe(healthChecker: HealthChecker): RequestHandler {
  return async (_req: Request, res: Response) => {
    try {
      const dbHealth = await healthChecker.checkDatabase();

      if (dbHealth.status === 'up') {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false, reason: 'Database not available' });
      }
    } catch {
      res.status(503).json({ ready: false });
    }
  };
}

export function createLivenessProbe(): RequestHandler {
  return (_req: Request, res: Response) => {
    res.status(200).json({ alive: true, timestamp: new Date().toISOString() });
  };
}

// ============================================================================
// Error Reporting
// ============================================================================

export function reportError(error: Error, context?: Record<string, any>): void {
  logger.error({ error, ...context }, 'Error reported');

  Sentry.captureException(error, {
    extra: context,
  });
}

export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// ============================================================================
// Exports
// ============================================================================

export { metricsCollector };
