/**
 * Security Middleware Module
 *
 * Production-grade security for AstroSwap Indexer API
 * Implements: Rate Limiting (Upstash), Helmet, Compression, Request Validation
 *
 * @module middleware/security
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import compression from 'compression';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface SecurityConfig {
  rateLimit: {
    global: RateLimitConfig;
    strict: RateLimitConfig;    // For sensitive endpoints
    relaxed: RateLimitConfig;   // For public data endpoints
  };
  slowDown: {
    enabled: boolean;
    windowMs: number;
    delayAfter: number;
    delayMs: number;
    maxDelayMs: number;
  };
  upstash: {
    enabled: boolean;
    url: string;
    token: string;
  };
  trustedProxies: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultSecurityConfig: SecurityConfig = {
  rateLimit: {
    global: {
      enabled: true,
      windowMs: 60 * 1000,      // 1 minute
      maxRequests: 100,          // 100 requests per minute
    },
    strict: {
      enabled: true,
      windowMs: 60 * 1000,      // 1 minute
      maxRequests: 20,           // 20 requests per minute (for heavy endpoints)
    },
    relaxed: {
      enabled: true,
      windowMs: 60 * 1000,      // 1 minute
      maxRequests: 200,          // 200 requests per minute (for stats/health)
    },
  },
  slowDown: {
    enabled: true,
    windowMs: 60 * 1000,        // 1 minute
    delayAfter: 50,             // Start slowing after 50 requests
    delayMs: 100,               // Add 100ms delay per request
    maxDelayMs: 2000,           // Max 2 second delay
  },
  upstash: {
    enabled: !!process.env.UPSTASH_REDIS_REST_URL,
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
  trustedProxies: ['loopback', 'linklocal', 'uniquelocal'],
};

// ============================================================================
// Upstash Redis Client (Singleton)
// ============================================================================

let redisClient: Redis | null = null;

export function getRedisClient(config: SecurityConfig): Redis | null {
  if (!config.upstash.enabled || !config.upstash.url || !config.upstash.token) {
    logger.info('Upstash Redis disabled or credentials not provided');
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        url: config.upstash.url,
        token: config.upstash.token,
      });
      logger.info('Upstash Redis client initialized');
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize Upstash Redis client');
      return null;
    }
  }

  return redisClient;
}

// ============================================================================
// Upstash Rate Limiter Cache
// ============================================================================

const rateLimiters = new Map<string, Ratelimit>();

function getOrCreateRateLimiter(
  redis: Redis,
  config: RateLimitConfig,
  prefix: string
): Ratelimit {
  const key = `${prefix}-${config.maxRequests}-${config.windowMs}`;

  if (!rateLimiters.has(key)) {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs}ms`),
      prefix,
      analytics: true,
    });
    rateLimiters.set(key, limiter);
  }

  return rateLimiters.get(key)!;
}

// ============================================================================
// Rate Limiting Middleware Factory (Upstash)
// ============================================================================

export function createRateLimiter(
  config: RateLimitConfig,
  redis: Redis | null,
  keyPrefix: string = 'rl:'
): RequestHandler {
  if (!config.enabled) {
    return (_req, _res, next) => next();
  }

  // If no Redis, use in-memory fallback
  if (!redis) {
    return createInMemoryRateLimiter(config, keyPrefix);
  }

  const limiter = getOrCreateRateLimiter(redis, config, keyPrefix);

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);

      // Set standard rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', reset);

      if (!success) {
        logger.warn(
          { ip: identifier, path: req.path, prefix: keyPrefix },
          'Rate limit exceeded'
        );

        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        });
        return;
      }

      next();
    } catch (err) {
      // On error, allow request but log warning
      logger.warn({ err, ip: identifier }, 'Rate limiter error, allowing request');
      next();
    }
  };
}

// ============================================================================
// In-Memory Rate Limiter (Fallback)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const inMemoryStore = new Map<string, RateLimitEntry>();

function createInMemoryRateLimiter(
  config: RateLimitConfig,
  keyPrefix: string
): RequestHandler {
  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (entry.resetTime < now) {
        inMemoryStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}${identifier}`;
    const now = Date.now();

    let entry = inMemoryStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
    }

    entry.count++;
    inMemoryStore.set(key, entry);

    // Set headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', entry.resetTime);

    if (entry.count > config.maxRequests) {
      logger.warn(
        { ip: identifier, path: req.path, prefix: keyPrefix },
        'Rate limit exceeded (in-memory)'
      );

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

// ============================================================================
// Speed Limiter (Gradual Slowdown)
// ============================================================================

export function createSpeedLimiter(
  config: SecurityConfig['slowDown'],
  _redis: Redis | null
): RequestHandler {
  if (!config.enabled) {
    return (_req, _res, next) => next();
  }

  return slowDown({
    windowMs: config.windowMs,
    delayAfter: config.delayAfter,
    delayMs: (used) => (used - config.delayAfter) * config.delayMs,
    maxDelayMs: config.maxDelayMs,
    keyGenerator: (req) => req.ip || 'unknown',
  });
}

// ============================================================================
// Helmet Security Headers
// ============================================================================

export function createHelmetMiddleware(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }) as RequestHandler;
}

// ============================================================================
// Compression Middleware
// ============================================================================

export function createCompressionMiddleware(): RequestHandler {
  return compression({
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress responses > 1KB
  });
}

// ============================================================================
// Request Sanitization
// ============================================================================

export function sanitizeRequest(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Sanitize query parameters
    if (req.query) {
      for (const key of Object.keys(req.query)) {
        const value = req.query[key];
        if (typeof value === 'string') {
          // Remove potential XSS characters
          req.query[key] = value
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .trim();
        }
      }
    }

    // Sanitize URL params
    if (req.params) {
      for (const key of Object.keys(req.params)) {
        const value = req.params[key];
        if (typeof value === 'string') {
          req.params[key] = value
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .trim();
        }
      }
    }

    next();
  };
}

// ============================================================================
// Request ID Middleware
// ============================================================================

export function addRequestId(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string ||
      `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  };
}

// ============================================================================
// Security Headers Middleware
// ============================================================================

export function addSecurityHeaders(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Additional security headers not covered by helmet
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Cache control for API responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  };
}

// ============================================================================
// IP Validation
// ============================================================================

const blockedIPs = new Set<string>();
const suspiciousIPs = new Map<string, number>();

export function ipValidator(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Check if IP is blocked
    if (blockedIPs.has(ip)) {
      logger.warn({ ip }, 'Blocked IP attempted access');
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
      });
      return;
    }

    // Track suspicious activity
    const suspiciousCount = suspiciousIPs.get(ip) || 0;
    if (suspiciousCount > 100) {
      blockedIPs.add(ip);
      logger.warn({ ip, count: suspiciousCount }, 'IP blocked due to suspicious activity');
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied due to suspicious activity',
      });
      return;
    }

    next();
  };
}

export function markSuspicious(ip: string): void {
  const current = suspiciousIPs.get(ip) || 0;
  suspiciousIPs.set(ip, current + 1);
}

export function blockIP(ip: string): void {
  blockedIPs.add(ip);
  logger.info({ ip }, 'IP manually blocked');
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
  suspiciousIPs.delete(ip);
  logger.info({ ip }, 'IP unblocked');
}

// ============================================================================
// Combined Security Setup
// ============================================================================

export interface SecurityMiddleware {
  helmet: RequestHandler;
  compression: RequestHandler;
  globalRateLimit: RequestHandler;
  strictRateLimit: RequestHandler;
  relaxedRateLimit: RequestHandler;
  speedLimit: RequestHandler;
  sanitize: RequestHandler;
  requestId: RequestHandler;
  securityHeaders: RequestHandler;
  ipValidator: RequestHandler;
}

export function setupSecurity(
  config: SecurityConfig = defaultSecurityConfig
): SecurityMiddleware {
  const redis = getRedisClient(config);

  logger.info(
    {
      upstashEnabled: config.upstash.enabled,
      redisConnected: !!redis,
    },
    'Security middleware initialized'
  );

  return {
    helmet: createHelmetMiddleware(),
    compression: createCompressionMiddleware(),
    globalRateLimit: createRateLimiter(config.rateLimit.global, redis, 'astroswap:rl:global:'),
    strictRateLimit: createRateLimiter(config.rateLimit.strict, redis, 'astroswap:rl:strict:'),
    relaxedRateLimit: createRateLimiter(config.rateLimit.relaxed, redis, 'astroswap:rl:relaxed:'),
    speedLimit: createSpeedLimiter(config.slowDown, redis),
    sanitize: sanitizeRequest(),
    requestId: addRequestId(),
    securityHeaders: addSecurityHeaders(),
    ipValidator: ipValidator(),
  };
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

export async function shutdownSecurity(): Promise<void> {
  // Upstash REST client doesn't need explicit disconnect
  // Just clear references
  redisClient = null;
  rateLimiters.clear();
  inMemoryStore.clear();
  logger.info('Security middleware shutdown complete');
}
