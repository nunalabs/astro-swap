/**
 * AstroSwap Indexer API Server
 *
 * Production-grade REST API with security, monitoring, and rate limiting
 *
 * @module api
 */

import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import {
  AddressSchema,
  PaginationSchema,
  TimeRangeSchema,
  PriceIntervalSchema,
  type IndexerConfig,
  type PairResponse,
  type SwapResponse,
  type LiquidityEventResponse,
  type PositionResponse,
  type PriceHistoryResponse,
  type StatsResponse,
} from './types';
import { calculatePrices } from './utils';
import {
  setupSecurity,
  shutdownSecurity,
  type SecurityMiddleware,
} from './middleware/security';
import {
  initSentry,
  requestTracker,
  sentryErrorHandler,
  HealthChecker,
  createHealthEndpoint,
  createReadinessProbe,
  createLivenessProbe,
  reportError,
  defaultMonitoringConfig,
} from './monitoring';

// ============================================================================
// API Server Class
// ============================================================================

export class APIServer {
  private app: Express;
  private prisma: PrismaClient;
  private config: IndexerConfig;
  private security: SecurityMiddleware;
  private healthChecker: HealthChecker;

  constructor(config: IndexerConfig, prisma: PrismaClient) {
    this.config = config;
    this.prisma = prisma;
    this.app = express();

    // Initialize security middleware
    this.security = setupSecurity();

    // Initialize health checker
    this.healthChecker = new HealthChecker(prisma, {
      stellarRpcUrl: config.stellar.rpcUrl,
    });

    // Initialize Sentry
    initSentry(this.app, defaultMonitoringConfig);

    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware with production security
   */
  private setupMiddleware(): void {
    // Trust proxy for rate limiting behind load balancer
    this.app.set('trust proxy', 1);

    // Request ID for tracing
    this.app.use(this.security.requestId);

    // Security headers (Helmet)
    this.app.use(this.security.helmet);
    this.app.use(this.security.securityHeaders);

    // Compression
    this.app.use(this.security.compression);

    // IP validation
    this.app.use(this.security.ipValidator);

    // CORS
    this.app.use(
      cors({
        origin: this.config.api.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
        exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
        maxAge: 86400, // 24 hours
      })
    );

    // Body parsing with limits
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request sanitization
    this.app.use(this.security.sanitize);

    // Request tracking/metrics
    this.app.use(requestTracker());

    // Global rate limiting
    this.app.use(this.security.globalRateLimit);

    // Speed limiter (gradual slowdown)
    this.app.use(this.security.speedLimit);
  }

  /**
   * Setup API routes with tiered rate limiting
   */
  private setupRoutes(): void {
    const router = express.Router();

    // ========================================
    // Health & Monitoring Endpoints (Relaxed rate limit)
    // ========================================

    // Kubernetes probes
    this.app.get('/healthz', createLivenessProbe());
    this.app.get('/readyz', createReadinessProbe(this.healthChecker));

    // Detailed health check
    router.get(
      '/health',
      this.security.relaxedRateLimit,
      createHealthEndpoint(this.healthChecker)
    );

    // ========================================
    // Public Data Endpoints (Standard rate limit)
    // ========================================

    // Pairs
    router.get('/pairs', this.asyncHandler(this.getPairs.bind(this)));
    router.get('/pairs/:address', this.asyncHandler(this.getPairDetails.bind(this)));
    router.get(
      '/pairs/:address/swaps',
      this.security.strictRateLimit, // Heavy query
      this.asyncHandler(this.getPairSwaps.bind(this))
    );
    router.get(
      '/pairs/:address/liquidity',
      this.security.strictRateLimit,
      this.asyncHandler(this.getPairLiquidity.bind(this))
    );
    router.get(
      '/pairs/:address/price-history',
      this.security.strictRateLimit,
      this.asyncHandler(this.getPairPriceHistory.bind(this))
    );

    // Users
    router.get(
      '/users/:address/positions',
      this.asyncHandler(this.getUserPositions.bind(this))
    );
    router.get(
      '/users/:address/swaps',
      this.security.strictRateLimit,
      this.asyncHandler(this.getUserSwaps.bind(this))
    );

    // Protocol stats (Relaxed - cached data)
    router.get(
      '/stats',
      this.security.relaxedRateLimit,
      this.asyncHandler(this.getProtocolStats.bind(this))
    );

    // Mount router
    this.app.use('/api/v1', router);

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        name: 'AstroSwap Indexer API',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        documentation: '/api/v1/docs',
        endpoints: {
          health: '/api/v1/health',
          pairs: '/api/v1/pairs',
          stats: '/api/v1/stats',
          probes: {
            liveness: '/healthz',
            readiness: '/readyz',
          },
        },
      });
    });
  }

  /**
   * Setup error handling with Sentry integration
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        requestId: req.headers['x-request-id'],
      });
    });

    // Sentry error handler
    this.app.use(sentryErrorHandler());

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string;

      // Log error
      logger.error(
        {
          err,
          path: req.path,
          method: req.method,
          requestId,
        },
        'API error'
      );

      // Report to Sentry
      reportError(err, {
        path: req.path,
        method: req.method,
        requestId,
        query: req.query,
      });

      // Determine status code
      const statusCode = 'statusCode' in err ? (err as any).statusCode : 500;

      // Send response
      res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : err.name,
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
        requestId,
      });
    });
  }

  /**
   * Async handler wrapper for route handlers
   */
  private asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Start API server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.api.port, () => {
        logger.info(
          {
            port: this.config.api.port,
            environment: process.env.NODE_ENV,
          },
          'API server started'
        );
        resolve();
      });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await shutdownSecurity();
    logger.info('API server shutdown complete');
  }

  // ============================================================================
  // Route Handlers
  // ============================================================================

  /**
   * GET /api/v1/pairs
   */
  private async getPairs(req: Request, res: Response): Promise<void> {
    const pagination = PaginationSchema.parse(req.query);
    const skip = (pagination.page - 1) * pagination.limit;

    const [pairs, total] = await Promise.all([
      this.prisma.pair.findMany({
        skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pair.count(),
    ]);

    const pairResponses: PairResponse[] = pairs.map((pair) =>
      this.formatPairResponse(pair)
    );

    res.json({
      data: pairResponses,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    });
  }

  /**
   * GET /api/v1/pairs/:address
   */
  private async getPairDetails(req: Request, res: Response): Promise<void> {
    const address = AddressSchema.parse(req.params.address);

    const pair = await this.prisma.pair.findUnique({
      where: { address },
    });

    if (!pair) {
      res.status(404).json({ error: 'Pair not found' });
      return;
    }

    res.json(this.formatPairResponse(pair));
  }

  /**
   * GET /api/v1/pairs/:address/swaps
   */
  private async getPairSwaps(req: Request, res: Response): Promise<void> {
    const address = AddressSchema.parse(req.params.address);
    const pagination = PaginationSchema.parse(req.query);
    const timeRange = TimeRangeSchema.parse(req.query);
    const skip = (pagination.page - 1) * pagination.limit;

    const pair = await this.prisma.pair.findUnique({
      where: { address },
    });

    if (!pair) {
      res.status(404).json({ error: 'Pair not found' });
      return;
    }

    const where = {
      pairId: pair.id,
      ...(timeRange.from && {
        timestamp: { gte: new Date(timeRange.from * 1000) },
      }),
      ...(timeRange.to && {
        timestamp: { lte: new Date(timeRange.to * 1000) },
      }),
    };

    const [swaps, total] = await Promise.all([
      this.prisma.swap.findMany({
        where,
        skip,
        take: pagination.limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.swap.count({ where }),
    ]);

    const swapResponses: SwapResponse[] = swaps.map((swap) => ({
      txHash: swap.txHash,
      sender: swap.sender,
      recipient: swap.recipient,
      amount0In: swap.amount0In,
      amount1In: swap.amount1In,
      amount0Out: swap.amount0Out,
      amount1Out: swap.amount1Out,
      amountInUSD: swap.amountInUSD?.toString(),
      amountOutUSD: swap.amountOutUSD?.toString(),
      timestamp: swap.timestamp.toISOString(),
    }));

    res.json({
      data: swapResponses,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    });
  }

  /**
   * GET /api/v1/pairs/:address/liquidity
   */
  private async getPairLiquidity(req: Request, res: Response): Promise<void> {
    const address = AddressSchema.parse(req.params.address);
    const pagination = PaginationSchema.parse(req.query);
    const skip = (pagination.page - 1) * pagination.limit;

    const pair = await this.prisma.pair.findUnique({
      where: { address },
    });

    if (!pair) {
      res.status(404).json({ error: 'Pair not found' });
      return;
    }

    const [events, total] = await Promise.all([
      this.prisma.liquidityEvent.findMany({
        where: { pairId: pair.id },
        skip,
        take: pagination.limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.liquidityEvent.count({ where: { pairId: pair.id } }),
    ]);

    const eventResponses: LiquidityEventResponse[] = events.map((event) => ({
      txHash: event.txHash,
      sender: event.sender,
      type: event.type,
      amount0: event.amount0,
      amount1: event.amount1,
      liquidity: event.liquidity,
      valueUSD: event.valueUSD?.toString(),
      timestamp: event.timestamp.toISOString(),
    }));

    res.json({
      data: eventResponses,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    });
  }

  /**
   * GET /api/v1/pairs/:address/price-history
   */
  private async getPairPriceHistory(req: Request, res: Response): Promise<void> {
    const address = AddressSchema.parse(req.params.address);
    const interval = PriceIntervalSchema.parse(req.query.interval || 'HOUR_1');
    const timeRange = TimeRangeSchema.parse(req.query);

    const pair = await this.prisma.pair.findUnique({
      where: { address },
    });

    if (!pair) {
      res.status(404).json({ error: 'Pair not found' });
      return;
    }

    const priceHistory = await this.prisma.priceHistory.findMany({
      where: {
        pairId: pair.id,
        interval,
        ...(timeRange.from && {
          timestamp: { gte: new Date(timeRange.from * 1000) },
        }),
        ...(timeRange.to && {
          timestamp: { lte: new Date(timeRange.to * 1000) },
        }),
      },
      orderBy: { timestamp: 'asc' },
      take: 1000, // Limit to prevent excessive data
    });

    const historyResponses: PriceHistoryResponse[] = priceHistory.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      price0: h.price0.toString(),
      price1: h.price1.toString(),
      reserve0: h.reserve0,
      reserve1: h.reserve1,
      volumeUSD: h.volumeUSD?.toString(),
      tvlUSD: h.tvlUSD?.toString(),
    }));

    res.json({
      data: historyResponses,
      interval,
    });
  }

  /**
   * GET /api/v1/users/:address/positions
   */
  private async getUserPositions(req: Request, res: Response): Promise<void> {
    const address = AddressSchema.parse(req.params.address);

    const positions = await this.prisma.position.findMany({
      where: { user: address },
      include: {
        pair: true,
      },
    });

    const positionResponses: PositionResponse[] = positions.map((pos) => ({
      user: pos.user,
      pair: {
        address: pos.pair.address,
        token0: pos.pair.token0,
        token1: pos.pair.token1,
      },
      lpBalance: pos.lpBalance,
      stakedBalance: pos.stakedBalance,
      token0Amount: pos.token0Amount,
      token1Amount: pos.token1Amount,
      valueUSD: pos.valueUSD?.toString(),
      firstDepositAt: pos.firstDepositAt?.toISOString(),
    }));

    res.json({ data: positionResponses });
  }

  /**
   * GET /api/v1/users/:address/swaps
   */
  private async getUserSwaps(req: Request, res: Response): Promise<void> {
    const address = AddressSchema.parse(req.params.address);
    const pagination = PaginationSchema.parse(req.query);
    const skip = (pagination.page - 1) * pagination.limit;

    const [swaps, total] = await Promise.all([
      this.prisma.swap.findMany({
        where: { sender: address },
        skip,
        take: pagination.limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.swap.count({ where: { sender: address } }),
    ]);

    const swapResponses: SwapResponse[] = swaps.map((swap) => ({
      txHash: swap.txHash,
      sender: swap.sender,
      recipient: swap.recipient,
      amount0In: swap.amount0In,
      amount1In: swap.amount1In,
      amount0Out: swap.amount0Out,
      amount1Out: swap.amount1Out,
      amountInUSD: swap.amountInUSD?.toString(),
      amountOutUSD: swap.amountOutUSD?.toString(),
      timestamp: swap.timestamp.toISOString(),
    }));

    res.json({
      data: swapResponses,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    });
  }

  /**
   * GET /api/v1/stats
   */
  private async getProtocolStats(_req: Request, res: Response): Promise<void> {
    const stats = await this.prisma.protocolStats.findUnique({
      where: { id: 'global' },
    });

    if (!stats) {
      res.json({
        totalVolumeUSD: '0',
        volume24hUSD: '0',
        totalTVLUSD: '0',
        totalFeesUSD: '0',
        fees24hUSD: '0',
        totalPairs: 0,
        totalUsers: 0,
        totalSwaps: 0,
      });
      return;
    }

    const statsResponse: StatsResponse = {
      totalVolumeUSD: stats.totalVolumeUSD.toString(),
      volume24hUSD: stats.volume24hUSD.toString(),
      totalTVLUSD: stats.totalTVLUSD.toString(),
      totalFeesUSD: stats.totalFeesUSD.toString(),
      fees24hUSD: stats.fees24hUSD.toString(),
      totalPairs: stats.totalPairs,
      totalUsers: stats.totalUsers,
      totalSwaps: stats.totalSwaps,
    };

    res.json(statsResponse);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private formatPairResponse(pair: any): PairResponse {
    const prices = calculatePrices(
      BigInt(pair.reserve0),
      BigInt(pair.reserve1),
      pair.token0Decimals,
      pair.token1Decimals
    );

    return {
      address: pair.address,
      token0: {
        address: pair.token0,
        symbol: pair.token0Symbol || 'UNKNOWN',
        decimals: pair.token0Decimals,
        reserve: pair.reserve0,
      },
      token1: {
        address: pair.token1,
        symbol: pair.token1Symbol || 'UNKNOWN',
        decimals: pair.token1Decimals,
        reserve: pair.reserve1,
      },
      totalSupply: pair.totalSupply,
      lpFee: pair.lpFee,
      protocolFee: pair.protocolFee,
      price0: prices.price0,
      price1: prices.price1,
      createdAt: pair.createdAt.toISOString(),
    };
  }
}
