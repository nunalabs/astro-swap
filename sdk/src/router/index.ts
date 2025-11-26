/**
 * AstroSwap Router SDK
 *
 * Optimal path-finding and route optimization for multi-hop swaps
 */

import type {
  RouterConfig,
  Route,
  SplitRoute,
  RouteQuote,
  SplitQuote,
  HopQuote,
  PoolData,
  RouterStats,
  PathSearchOptions,
} from './types';
import { RouterError, RouterErrorCode } from './types';
import { PoolCache } from './pool-cache';
import { Pathfinder } from './pathfinder';
import { SplitOptimizer } from './split-optimizer';
import { FactoryClient } from '../contracts/factory';
import { PairClient } from '../contracts/pair';
import { getAmountOut, calculatePriceImpact } from '../utils';

/**
 * AstroSwap Router for optimal path finding and trade execution
 *
 * @example
 * ```typescript
 * const router = new AstroSwapRouter({
 *   factoryAddress: 'CXXX...',
 *   network: NETWORKS.testnet,
 *   maxHops: 3,
 *   maxSplits: 3,
 * });
 *
 * // Find best route
 * const route = await router.findBestRoute(
 *   'USDC_ADDRESS',
 *   'XLM_ADDRESS',
 *   1000000000n
 * );
 *
 * // Find optimal split
 * const split = await router.findOptimalSplit(
 *   'USDC_ADDRESS',
 *   'XLM_ADDRESS',
 *   10000000000n
 * );
 * ```
 */
export class AstroSwapRouter {
  private config: Required<RouterConfig>;
  private poolCache: PoolCache;
  private factoryClient: FactoryClient;
  private routeFindingTimes: number[];

  /**
   * Create a new AstroSwap Router
   * @param config - Router configuration
   */
  constructor(config: RouterConfig) {
    // Set defaults
    this.config = {
      factoryAddress: config.factoryAddress,
      network: config.network,
      maxHops: config.maxHops ?? 3,
      maxSplits: config.maxSplits ?? 3,
      poolCacheTTL: config.poolCacheTTL ?? 30000,
      enableCache: config.enableCache ?? true,
      minLiquidity: config.minLiquidity ?? 1000n,
    };

    // Initialize components
    this.poolCache = new PoolCache(this.config.poolCacheTTL);
    this.factoryClient = new FactoryClient({
      contractId: this.config.factoryAddress,
      network: this.config.network,
    });
    this.routeFindingTimes = [];

    // Validate configuration
    this.validateConfig();
  }

  // ==================== Public Methods ====================

  /**
   * Find the best single route between two tokens
   *
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param amountIn - Input amount
   * @param maxHops - Maximum hops (overrides config)
   * @returns Best route or null if no route found
   *
   * @example
   * ```typescript
   * const route = await router.findBestRoute(
   *   'USDC_ADDRESS',
   *   'XLM_ADDRESS',
   *   1000000000n,
   *   2 // max 2 hops
   * );
   * ```
   */
  async findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    maxHops?: number
  ): Promise<Route | null> {
    const startTime = performance.now();

    try {
      // Ensure pools are loaded
      await this.ensurePoolsLoaded();

      // Get token graph
      const graph = this.poolCache.getGraph();

      // Search options
      const options: PathSearchOptions = {
        maxHops: maxHops ?? this.config.maxHops,
        minLiquidity: this.config.minLiquidity,
      };

      // Find best path
      const route = Pathfinder.findBestPath(graph, tokenIn, tokenOut, amountIn, options);

      return route;
    } catch (error) {
      if (error instanceof RouterError) {
        throw error;
      }
      throw new RouterError(
        RouterErrorCode.NoRouteFound,
        `Failed to find route: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.routeFindingTimes.push(performance.now() - startTime);
    }
  }

  /**
   * Find all possible routes between two tokens
   *
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param maxHops - Maximum hops (overrides config)
   * @returns Array of all routes
   *
   * @example
   * ```typescript
   * const routes = await router.findAllRoutes(
   *   'USDC_ADDRESS',
   *   'XLM_ADDRESS',
   *   3
   * );
   * console.log(`Found ${routes.length} routes`);
   * ```
   */
  async findAllRoutes(
    tokenIn: string,
    tokenOut: string,
    maxHops?: number
  ): Promise<Route[]> {
    try {
      // Ensure pools are loaded
      await this.ensurePoolsLoaded();

      // Get token graph
      const graph = this.poolCache.getGraph();

      // Search options
      const options: PathSearchOptions = {
        maxHops: maxHops ?? this.config.maxHops,
        minLiquidity: this.config.minLiquidity,
      };

      // Find all paths
      const paths = Pathfinder.findAllPaths(graph, tokenIn, tokenOut, options);

      // Note: We need an amount to calculate routes, using 1000000n as default
      const defaultAmount = 1000000n;
      const routes = paths
        .map(path => Pathfinder.calculateRoute(path, defaultAmount))
        .filter((route): route is Route => route !== null);

      return Pathfinder.sortRoutes(routes);
    } catch (error) {
      if (error instanceof RouterError) {
        throw error;
      }
      throw new RouterError(
        RouterErrorCode.NoRouteFound,
        `Failed to find routes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find optimal split across multiple routes
   *
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param amountIn - Total input amount
   * @param maxSplits - Maximum splits (overrides config)
   * @returns Optimal split route
   *
   * @example
   * ```typescript
   * const split = await router.findOptimalSplit(
   *   'USDC_ADDRESS',
   *   'XLM_ADDRESS',
   *   10000000000n
   * );
   * console.log(`Split across ${split.routes.length} routes`);
   * ```
   */
  async findOptimalSplit(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    maxSplits?: number
  ): Promise<SplitRoute> {
    try {
      // Ensure pools are loaded
      await this.ensurePoolsLoaded();

      // Get token graph
      const graph = this.poolCache.getGraph();

      // Search options
      const options: PathSearchOptions = {
        maxHops: this.config.maxHops,
        minLiquidity: this.config.minLiquidity,
      };

      // Find all paths
      const paths = Pathfinder.findAllPaths(graph, tokenIn, tokenOut, options);

      if (paths.length === 0) {
        throw new RouterError(
          RouterErrorCode.NoRouteFound,
          `No route found between ${tokenIn} and ${tokenOut}`
        );
      }

      // Calculate routes
      const routes = paths
        .map(path => Pathfinder.calculateRoute(path, amountIn))
        .filter((route): route is Route => route !== null);

      if (routes.length === 0) {
        throw new RouterError(
          RouterErrorCode.InsufficientLiquidity,
          'No routes with sufficient liquidity'
        );
      }

      // Find optimal split
      const splits = maxSplits ?? this.config.maxSplits;
      const splitRoute = SplitOptimizer.findOptimalSplit(routes, amountIn, splits);

      return splitRoute;
    } catch (error) {
      if (error instanceof RouterError) {
        throw error;
      }
      throw new RouterError(
        RouterErrorCode.OptimizationFailed,
        `Failed to optimize split: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get detailed quote for a specific route
   *
   * @param route - Route to quote
   * @param amountIn - Input amount
   * @returns Detailed quote with hop-by-hop breakdown
   *
   * @example
   * ```typescript
   * const quote = await router.getRouteQuote(route, 1000000000n);
   * console.log(`Output: ${quote.amountOut}`);
   * console.log(`Price impact: ${quote.route.priceImpactBps / 100}%`);
   * ```
   */
  async getRouteQuote(route: Route, amountIn: bigint): Promise<RouteQuote> {
    // Get pool data for each hop
    const poolsData: PoolData[] = [];

    for (const poolAddress of route.pools) {
      let poolData = this.poolCache.get(poolAddress);

      if (!poolData) {
        // Fetch from contract
        const pairClient = new PairClient({
          contractId: poolAddress,
          network: this.config.network,
        });

        const pairInfo = await pairClient.getPairInfo();
        poolData = {
          address: poolAddress,
          token0: pairInfo.token0,
          token1: pairInfo.token1,
          reserve0: pairInfo.reserve0,
          reserve1: pairInfo.reserve1,
          feeBps: pairInfo.feeBps,
          cachedAt: Date.now(),
        };

        this.poolCache.set(poolAddress, poolData);
      }

      poolsData.push(poolData);
    }

    // Calculate hop-by-hop
    const hops: HopQuote[] = [];
    const amounts: bigint[] = [amountIn];
    let currentAmount = amountIn;

    for (let i = 0; i < poolsData.length; i++) {
      const pool = poolsData[i];
      const tokenIn = route.path[i];
      const tokenOut = route.path[i + 1];

      // Determine reserves
      const isToken0In = tokenIn.toLowerCase() === pool.token0.toLowerCase();
      const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
      const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;

      // Calculate output
      const amountOut = getAmountOut(currentAmount, reserveIn, reserveOut, pool.feeBps);
      const priceImpactBps = calculatePriceImpact(
        currentAmount,
        reserveIn,
        reserveOut,
        pool.feeBps
      );

      hops.push({
        pool: pool.address,
        tokenIn,
        tokenOut,
        amountIn: currentAmount,
        amountOut,
        priceImpactBps,
        feeBps: pool.feeBps,
      });

      amounts.push(amountOut);
      currentAmount = amountOut;
    }

    return {
      route,
      amountIn,
      amountOut: currentAmount,
      amounts,
      hops,
    };
  }

  /**
   * Get detailed quote for a split route
   *
   * @param splitRoute - Split route to quote
   * @param amountIn - Total input amount
   * @returns Detailed split quote
   */
  async getSplitQuote(splitRoute: SplitRoute, amountIn: bigint): Promise<SplitQuote> {
    const routeQuotes: RouteQuote[] = [];

    for (let i = 0; i < splitRoute.routes.length; i++) {
      const route = splitRoute.routes[i];
      const amount = splitRoute.amounts[i];
      const quote = await this.getRouteQuote(route, amount);
      routeQuotes.push(quote);
    }

    const totalAmountOut = routeQuotes.reduce((sum, q) => sum + q.amountOut, 0n);

    return {
      splitRoute,
      amountIn,
      totalAmountOut,
      routeQuotes,
    };
  }

  /**
   * Refresh pool cache by fetching latest data
   *
   * @param forceRefresh - Force refresh even if cache is valid
   */
  async refreshPools(forceRefresh: boolean = false): Promise<void> {
    if (forceRefresh) {
      this.poolCache.clear();
    }

    await this.loadPools();
  }

  /**
   * Get router statistics
   *
   * @returns Current router statistics
   */
  getStats(): RouterStats {
    const cacheStats = this.poolCache.getStats();
    const avgTime =
      this.routeFindingTimes.length > 0
        ? this.routeFindingTimes.reduce((a, b) => a + b, 0) / this.routeFindingTimes.length
        : 0;

    return {
      cachedPools: cacheStats.size,
      cacheHitRate: cacheStats.hitRate,
      avgRouteFindingTime: avgTime,
      totalRoutesFound: this.routeFindingTimes.length,
      totalSplitRoutes: 0, // Could track this if needed
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.poolCache.clear();
    this.routeFindingTimes = [];
  }

  // ==================== Private Methods ====================

  /**
   * Validate router configuration
   */
  private validateConfig(): void {
    if (!this.config.factoryAddress) {
      throw new RouterError(
        RouterErrorCode.InvalidConfiguration,
        'Factory address is required'
      );
    }

    if (this.config.maxHops < 1 || this.config.maxHops > 5) {
      throw new RouterError(
        RouterErrorCode.InvalidConfiguration,
        'maxHops must be between 1 and 5'
      );
    }

    if (this.config.maxSplits < 1 || this.config.maxSplits > 10) {
      throw new RouterError(
        RouterErrorCode.InvalidConfiguration,
        'maxSplits must be between 1 and 10'
      );
    }
  }

  /**
   * Ensure pools are loaded in cache
   */
  private async ensurePoolsLoaded(): Promise<void> {
    const stats = this.poolCache.getStats();

    if (stats.size === 0) {
      await this.loadPools();
    } else if (this.config.enableCache) {
      // Clean expired entries
      this.poolCache.cleanExpired();
    }
  }

  /**
   * Load all pools from factory
   */
  private async loadPools(): Promise<void> {
    try {
      // Get all pair addresses from factory
      const pairAddresses = await this.factoryClient.getAllPairs();

      // Fetch pool data for each pair
      const poolDataPromises = pairAddresses.map(async address => {
        // Check cache first
        if (this.config.enableCache) {
          const cached = this.poolCache.get(address);
          if (cached) return cached;
        }

        // Fetch from contract
        const pairClient = new PairClient({
          contractId: address,
          network: this.config.network,
        });

        const pairInfo = await pairClient.getPairInfo();

        return {
          address,
          token0: pairInfo.token0,
          token1: pairInfo.token1,
          reserve0: pairInfo.reserve0,
          reserve1: pairInfo.reserve1,
          feeBps: pairInfo.feeBps,
          cachedAt: Date.now(),
        };
      });

      const poolsData = await Promise.all(poolDataPromises);

      // Update cache
      if (this.config.enableCache) {
        this.poolCache.setMany(poolsData);
      }
    } catch (error) {
      throw new RouterError(
        RouterErrorCode.CacheError,
        `Failed to load pools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Re-export types
export * from './types';
export { PoolCache } from './pool-cache';
export { Pathfinder } from './pathfinder';
export { SplitOptimizer } from './split-optimizer';
