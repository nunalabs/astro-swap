/**
 * Router Types
 *
 * TypeScript types for the AstroSwap Router SDK
 */

import type { NetworkConfig } from '../types';

// ==================== Configuration ====================

/**
 * Router configuration options
 */
export interface RouterConfig {
  /** Factory contract address */
  factoryAddress: string;
  /** Network configuration */
  network: NetworkConfig;
  /** Maximum number of hops in a route (default: 3) */
  maxHops?: number;
  /** Maximum number of splits for a trade (default: 3) */
  maxSplits?: number;
  /** Pool data cache TTL in milliseconds (default: 30000) */
  poolCacheTTL?: number;
  /** Enable aggressive caching (default: true) */
  enableCache?: boolean;
  /** Minimum liquidity threshold for considering a pool */
  minLiquidity?: bigint;
}

// ==================== Route Types ====================

/**
 * A single route through the DEX
 */
export interface Route {
  /** Token path (e.g., [USDC, XLM, BTC]) */
  path: string[];
  /** Pool addresses for each hop */
  pools: string[];
  /** Expected output amount */
  expectedOutput: bigint;
  /** Price impact in basis points */
  priceImpactBps: number;
  /** Route quality score (higher is better) */
  score: number;
}

/**
 * A split route distributing input across multiple routes
 */
export interface SplitRoute {
  /** Individual routes to use */
  routes: Route[];
  /** Amount to send through each route */
  amounts: bigint[];
  /** Percentage allocation for each route (sum to 100) */
  percentages: number[];
  /** Total expected output across all routes */
  totalOutput: bigint;
  /** Weighted average price impact in basis points */
  totalPriceImpactBps: number;
  /** Whether split routing improves output vs single route */
  isBetterThanSingleRoute: boolean;
}

// ==================== Pool Data Types ====================

/**
 * Cached pool data
 */
export interface PoolData {
  /** Pool contract address */
  address: string;
  /** Token 0 address */
  token0: string;
  /** Token 1 address */
  token1: string;
  /** Reserve for token 0 */
  reserve0: bigint;
  /** Reserve for token 1 */
  reserve1: bigint;
  /** Trading fee in basis points */
  feeBps: number;
  /** Timestamp when data was cached */
  cachedAt: number;
}

/**
 * Pool cache entry
 */
export interface PoolCacheEntry {
  /** Pool data */
  data: PoolData;
  /** Expiration timestamp */
  expiresAt: number;
}

/**
 * Graph node representing a token
 */
export interface TokenNode {
  /** Token address */
  address: string;
  /** Connected pools */
  pools: PoolData[];
}

/**
 * Token graph for pathfinding
 */
export interface TokenGraph {
  /** Map of token address to node */
  nodes: Map<string, TokenNode>;
  /** All pools in the graph */
  pools: PoolData[];
}

// ==================== Pathfinding Types ====================

/**
 * Path search options
 */
export interface PathSearchOptions {
  /** Maximum number of hops */
  maxHops: number;
  /** Minimum liquidity to consider a pool */
  minLiquidity?: bigint;
  /** Exclude specific pools */
  excludePools?: string[];
  /** Exclude specific tokens */
  excludeTokens?: string[];
}

/**
 * Path found during search
 */
export interface PathCandidate {
  /** Token addresses in path */
  tokens: string[];
  /** Pool addresses for each hop */
  pools: PoolData[];
}

// ==================== Quote Types ====================

/**
 * Quote for a specific route
 */
export interface RouteQuote {
  /** The route */
  route: Route;
  /** Input amount */
  amountIn: bigint;
  /** Output amount */
  amountOut: bigint;
  /** Amounts at each hop */
  amounts: bigint[];
  /** Price impact at each hop (in bps) */
  hops: HopQuote[];
  /** Total gas estimate (if available) */
  estimatedGas?: bigint;
}

/**
 * Quote for a single hop in a route
 */
export interface HopQuote {
  /** Pool address */
  pool: string;
  /** Token in */
  tokenIn: string;
  /** Token out */
  tokenOut: string;
  /** Amount in */
  amountIn: bigint;
  /** Amount out */
  amountOut: bigint;
  /** Price impact in basis points */
  priceImpactBps: number;
  /** Fee in basis points */
  feeBps: number;
}

/**
 * Quote for a split trade
 */
export interface SplitQuote {
  /** Split route configuration */
  splitRoute: SplitRoute;
  /** Input amount */
  amountIn: bigint;
  /** Total output amount */
  totalAmountOut: bigint;
  /** Quotes for each route */
  routeQuotes: RouteQuote[];
}

// ==================== Optimization Types ====================

/**
 * Split distribution to test
 */
export interface SplitDistribution {
  /** Percentages for each route */
  percentages: number[];
  /** Expected output for this distribution */
  expectedOutput: bigint;
  /** Price impact for this distribution */
  priceImpact: number;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  /** Optimal split route */
  splitRoute: SplitRoute;
  /** All tested distributions */
  testedDistributions: SplitDistribution[];
  /** Number of iterations performed */
  iterations: number;
}

// ==================== Statistics Types ====================

/**
 * Router statistics
 */
export interface RouterStats {
  /** Number of cached pools */
  cachedPools: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Average route finding time (ms) */
  avgRouteFindingTime: number;
  /** Total routes found */
  totalRoutesFound: number;
  /** Total split routes generated */
  totalSplitRoutes: number;
}

// ==================== Error Types ====================

/**
 * Router-specific errors
 */
export enum RouterErrorCode {
  NoRouteFound = 'NO_ROUTE_FOUND',
  InvalidTokenPair = 'INVALID_TOKEN_PAIR',
  InsufficientLiquidity = 'INSUFFICIENT_LIQUIDITY',
  InvalidPath = 'INVALID_PATH',
  CacheError = 'CACHE_ERROR',
  InvalidConfiguration = 'INVALID_CONFIGURATION',
  OptimizationFailed = 'OPTIMIZATION_FAILED',
}

/**
 * Router error class
 */
export class RouterError extends Error {
  constructor(
    public code: RouterErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RouterError';
  }
}
