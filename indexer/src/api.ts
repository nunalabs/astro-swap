import express, { Request, Response, NextFunction } from 'express';
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

export class APIServer {
  private app: express.Application;
  private prisma: PrismaClient;
  private config: IndexerConfig;

  constructor(config: IndexerConfig, prisma: PrismaClient) {
    this.config = config;
    this.prisma = prisma;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: this.config.api.corsOrigins,
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, _res, next) => {
      logger.info(
        {
          method: req.method,
          path: req.path,
          query: req.query,
        },
        'Incoming request'
      );
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    const router = express.Router();

    // Health check
    router.get('/health', this.getHealth.bind(this));

    // Pairs
    router.get('/pairs', this.getPairs.bind(this));
    router.get('/pairs/:address', this.getPairDetails.bind(this));
    router.get('/pairs/:address/swaps', this.getPairSwaps.bind(this));
    router.get('/pairs/:address/liquidity', this.getPairLiquidity.bind(this));
    router.get('/pairs/:address/price-history', this.getPairPriceHistory.bind(this));

    // Users
    router.get('/users/:address/positions', this.getUserPositions.bind(this));
    router.get('/users/:address/swaps', this.getUserSwaps.bind(this));

    // Protocol stats
    router.get('/stats', this.getProtocolStats.bind(this));

    // Mount router
    this.app.use('/api/v1', router);

    // Root redirect
    this.app.get('/', (_req, res) => {
      res.json({
        name: 'AstroSwap Indexer API',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          pairs: '/api/v1/pairs',
          stats: '/api/v1/stats',
        },
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error({ err, path: req.path }, 'API error');

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
      });
    });
  }

  /**
   * Start API server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.api.port, () => {
        logger.info({ port: this.config.api.port }, 'API server started');
        resolve();
      });
    });
  }

  // ============================================================================
  // Route Handlers
  // ============================================================================

  /**
   * GET /health
   */
  private async getHealth(_req: Request, res: Response): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  }

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
