/**
 * Pathfinder
 *
 * Finds all possible routes between two tokens using BFS/DFS
 */

import type {
  PoolData,
  TokenGraph,
  PathCandidate,
  PathSearchOptions,
  Route,
} from './types';
import { RouterError, RouterErrorCode } from './types';
import { getAmountOut, calculatePriceImpact } from '../utils';

/**
 * Pathfinding algorithm for finding optimal routes
 */
export class Pathfinder {
  /**
   * Find all possible paths between two tokens
   * @param graph - Token graph
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param options - Search options
   * @returns Array of path candidates
   */
  static findAllPaths(
    graph: TokenGraph,
    tokenIn: string,
    tokenOut: string,
    options: PathSearchOptions
  ): PathCandidate[] {
    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();

    // Validate inputs
    if (tokenInLower === tokenOutLower) {
      throw new RouterError(
        RouterErrorCode.InvalidTokenPair,
        'Input and output tokens are the same'
      );
    }

    if (!graph.nodes.has(tokenInLower)) {
      throw new RouterError(
        RouterErrorCode.InvalidTokenPair,
        `Token ${tokenIn} not found in liquidity graph`
      );
    }

    if (!graph.nodes.has(tokenOutLower)) {
      throw new RouterError(
        RouterErrorCode.InvalidTokenPair,
        `Token ${tokenOut} not found in liquidity graph`
      );
    }

    const paths: PathCandidate[] = [];
    const visited = new Set<string>();
    const excludeTokens = new Set(
      options.excludeTokens?.map(t => t.toLowerCase()) || []
    );
    const excludePools = new Set(
      options.excludePools?.map(p => p.toLowerCase()) || []
    );

    /**
     * DFS recursive function
     */
    const dfs = (
      currentToken: string,
      currentPath: string[],
      currentPools: PoolData[],
      depth: number
    ): void => {
      // Check if we reached the destination
      if (currentToken.toLowerCase() === tokenOutLower) {
        paths.push({
          tokens: [...currentPath],
          pools: [...currentPools],
        });
        return;
      }

      // Check max depth
      if (depth >= options.maxHops) {
        return;
      }

      // Mark as visited
      visited.add(currentToken.toLowerCase());

      // Get pools for current token
      const node = graph.nodes.get(currentToken.toLowerCase());
      if (!node) return;

      // Try each connected pool
      for (const pool of node.pools) {
        // Skip excluded pools
        if (excludePools.has(pool.address.toLowerCase())) {
          continue;
        }

        // Skip pools with insufficient liquidity
        if (options.minLiquidity) {
          if (pool.reserve0 < options.minLiquidity || pool.reserve1 < options.minLiquidity) {
            continue;
          }
        }

        // Get the next token
        const nextToken =
          pool.token0.toLowerCase() === currentToken.toLowerCase()
            ? pool.token1
            : pool.token0;

        const nextTokenLower = nextToken.toLowerCase();

        // Skip if already visited or excluded
        if (visited.has(nextTokenLower) || excludeTokens.has(nextTokenLower)) {
          continue;
        }

        // Continue DFS
        dfs(
          nextToken,
          [...currentPath, nextToken],
          [...currentPools, pool],
          depth + 1
        );
      }

      // Unmark as visited (backtrack)
      visited.delete(currentToken.toLowerCase());
    };

    // Start DFS from tokenIn
    dfs(tokenIn, [tokenIn], [], 0);

    return paths;
  }

  /**
   * Find the single best path based on expected output
   * @param graph - Token graph
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param amountIn - Input amount
   * @param options - Search options
   * @returns Best route or null
   */
  static findBestPath(
    graph: TokenGraph,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    options: PathSearchOptions
  ): Route | null {
    const paths = this.findAllPaths(graph, tokenIn, tokenOut, options);

    if (paths.length === 0) {
      return null;
    }

    // Calculate output for each path
    const routes = paths
      .map(path => this.calculateRoute(path, amountIn))
      .filter((route): route is Route => route !== null);

    if (routes.length === 0) {
      return null;
    }

    // Sort by expected output (descending) and then by price impact (ascending)
    routes.sort((a, b) => {
      const outputDiff = Number(b.expectedOutput - a.expectedOutput);
      if (outputDiff !== 0) return outputDiff;
      return a.priceImpactBps - b.priceImpactBps;
    });

    return routes[0];
  }

  /**
   * Calculate route details including expected output and price impact
   * @param path - Path candidate
   * @param amountIn - Input amount
   * @returns Route with calculations or null if invalid
   */
  static calculateRoute(path: PathCandidate, amountIn: bigint): Route | null {
    try {
      let currentAmount = amountIn;
      let totalPriceImpact = 0;
      const amounts: bigint[] = [amountIn];

      // Calculate through each hop
      for (let i = 0; i < path.pools.length; i++) {
        const pool = path.pools[i];
        const tokenIn = path.tokens[i];

        // Determine which reserve is in and which is out
        const isToken0In = tokenIn.toLowerCase() === pool.token0.toLowerCase();
        const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
        const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;

        // Calculate output for this hop
        const amountOut = getAmountOut(currentAmount, reserveIn, reserveOut, pool.feeBps);

        // Calculate price impact for this hop
        const priceImpact = calculatePriceImpact(
          currentAmount,
          reserveIn,
          reserveOut,
          pool.feeBps
        );

        // Accumulate price impact (simplified)
        totalPriceImpact += priceImpact;

        amounts.push(amountOut);
        currentAmount = amountOut;

        // Safety check
        if (amountOut <= 0n) {
          return null;
        }
      }

      // Calculate route quality score
      const score = this.calculateRouteScore(
        amountIn,
        currentAmount,
        totalPriceImpact,
        path.pools.length
      );

      return {
        path: path.tokens,
        pools: path.pools.map(p => p.address),
        expectedOutput: currentAmount,
        priceImpactBps: totalPriceImpact,
        score,
      };
    } catch (error) {
      // Invalid route (e.g., insufficient liquidity)
      return null;
    }
  }

  /**
   * Calculate route quality score
   * Higher score is better
   * @param amountIn - Input amount
   * @param amountOut - Output amount
   * @param priceImpactBps - Price impact in basis points
   * @param hops - Number of hops
   * @returns Quality score
   */
  private static calculateRouteScore(
    amountIn: bigint,
    amountOut: bigint,
    priceImpactBps: number,
    hops: number
  ): number {
    // Base score on output amount (higher is better)
    const outputScore = Number(amountOut) / Number(amountIn);

    // Penalize high price impact
    const impactPenalty = Math.max(0, 1 - priceImpactBps / 10000);

    // Penalize more hops (each hop adds complexity and potential for failure)
    const hopsPenalty = Math.pow(0.95, hops - 1);

    return outputScore * impactPenalty * hopsPenalty;
  }

  /**
   * Filter routes by minimum output and maximum price impact
   * @param routes - Routes to filter
   * @param minOutput - Minimum acceptable output
   * @param maxPriceImpactBps - Maximum acceptable price impact (in bps)
   * @returns Filtered routes
   */
  static filterRoutes(
    routes: Route[],
    minOutput?: bigint,
    maxPriceImpactBps?: number
  ): Route[] {
    return routes.filter(route => {
      if (minOutput && route.expectedOutput < minOutput) {
        return false;
      }
      if (maxPriceImpactBps && route.priceImpactBps > maxPriceImpactBps) {
        return false;
      }
      return true;
    });
  }

  /**
   * Sort routes by quality score
   * @param routes - Routes to sort
   * @returns Sorted routes (best first)
   */
  static sortRoutes(routes: Route[]): Route[] {
    return [...routes].sort((a, b) => b.score - a.score);
  }

  /**
   * Get top N routes
   * @param routes - Routes to filter
   * @param n - Number of top routes to return
   * @returns Top N routes
   */
  static getTopRoutes(routes: Route[], n: number): Route[] {
    const sorted = this.sortRoutes(routes);
    return sorted.slice(0, n);
  }

  /**
   * Find direct route (single hop)
   * @param graph - Token graph
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param amountIn - Input amount
   * @returns Direct route or null
   */
  static findDirectRoute(
    graph: TokenGraph,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Route | null {
    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();

    const node = graph.nodes.get(tokenInLower);
    if (!node) return null;

    // Find pool connecting these tokens
    const pool = node.pools.find(
      p =>
        p.token0.toLowerCase() === tokenOutLower ||
        p.token1.toLowerCase() === tokenOutLower
    );

    if (!pool) return null;

    const path: PathCandidate = {
      tokens: [tokenIn, tokenOut],
      pools: [pool],
    };

    return this.calculateRoute(path, amountIn);
  }
}
