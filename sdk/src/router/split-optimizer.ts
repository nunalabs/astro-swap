/**
 * Split Optimizer
 *
 * Optimizes trade splitting across multiple routes to minimize price impact
 */

import type {
  Route,
  SplitRoute,
  SplitDistribution,
  OptimizationResult,
} from './types';
import { Pathfinder } from './pathfinder';

/**
 * Optimizer for splitting trades across multiple routes
 */
export class SplitOptimizer {
  /**
   * Find optimal split across multiple routes
   * @param routes - Available routes
   * @param amountIn - Total input amount
   * @param maxSplits - Maximum number of routes to split across
   * @returns Optimal split route
   */
  static findOptimalSplit(
    routes: Route[],
    amountIn: bigint,
    maxSplits: number = 3
  ): SplitRoute {
    if (routes.length === 0) {
      throw new Error('No routes available for splitting');
    }

    // If only one route, no splitting needed
    if (routes.length === 1 || maxSplits === 1) {
      return this.createSingleRouteSplit(routes[0], amountIn);
    }

    // Get top routes for splitting
    const topRoutes = Pathfinder.getTopRoutes(routes, Math.min(maxSplits, routes.length));

    if (topRoutes.length === 1) {
      return this.createSingleRouteSplit(topRoutes[0], amountIn);
    }

    // Test various split distributions
    const distributions = this.generateDistributions(topRoutes.length);
    const results: SplitDistribution[] = [];

    for (const distribution of distributions) {
      const result = this.evaluateDistribution(topRoutes, amountIn, distribution);
      if (result) {
        results.push(result);
      }
    }

    // Find best distribution
    const bestDistribution = results.reduce((best, current) =>
      current.expectedOutput > best.expectedOutput ? current : best
    );

    // Create split route
    const splitRoute = this.createSplitRoute(
      topRoutes,
      amountIn,
      bestDistribution.percentages
    );

    return splitRoute;
  }

  /**
   * Optimize split using gradient descent
   * @param routes - Available routes
   * @param amountIn - Total input amount
   * @param maxSplits - Maximum number of routes
   * @param iterations - Number of optimization iterations
   * @returns Optimization result
   */
  static optimize(
    routes: Route[],
    amountIn: bigint,
    maxSplits: number = 3,
    iterations: number = 10
  ): OptimizationResult {
    const topRoutes = Pathfinder.getTopRoutes(routes, Math.min(maxSplits, routes.length));
    const testedDistributions: SplitDistribution[] = [];

    // Start with equal distribution
    let currentPercentages = this.createEqualDistribution(topRoutes.length);

    for (let i = 0; i < iterations; i++) {
      const current = this.evaluateDistribution(topRoutes, amountIn, currentPercentages);
      if (current) {
        testedDistributions.push(current);
      }

      // Try small adjustments
      const neighbors = this.generateNeighbors(currentPercentages);
      let bestNeighbor = current;

      for (const neighbor of neighbors) {
        const result = this.evaluateDistribution(topRoutes, amountIn, neighbor);
        if (result && result.expectedOutput > (bestNeighbor?.expectedOutput || 0n)) {
          bestNeighbor = result;
          currentPercentages = neighbor;
        }
      }

      // No improvement found
      if (bestNeighbor === current) {
        break;
      }
    }

    // Create final split route
    const splitRoute = this.createSplitRoute(topRoutes, amountIn, currentPercentages);

    return {
      splitRoute,
      testedDistributions,
      iterations: testedDistributions.length,
    };
  }

  /**
   * Compare split route vs single best route
   * @param splitRoute - Split route to evaluate
   * @param singleRoute - Best single route
   * @returns Whether split is better
   */
  static isSplitBetter(splitRoute: SplitRoute, singleRoute: Route): boolean {
    // Split is better if output is higher and price impact is lower or similar
    const outputImprovement = splitRoute.totalOutput > singleRoute.expectedOutput;
    const priceImpactSimilar =
      splitRoute.totalPriceImpactBps <= singleRoute.priceImpactBps * 1.1;

    return outputImprovement && priceImpactSimilar;
  }

  // ==================== Private Methods ====================

  /**
   * Create a split route with single route
   */
  private static createSingleRouteSplit(route: Route, amountIn: bigint): SplitRoute {
    return {
      routes: [route],
      amounts: [amountIn],
      percentages: [100],
      totalOutput: route.expectedOutput,
      totalPriceImpactBps: route.priceImpactBps,
      isBetterThanSingleRoute: false,
    };
  }

  /**
   * Generate split distributions to test
   */
  private static generateDistributions(routeCount: number): number[][] {
    if (routeCount === 2) {
      return [
        [100, 0],
        [90, 10],
        [80, 20],
        [70, 30],
        [60, 40],
        [50, 50],
        [40, 60],
        [30, 70],
        [20, 80],
        [10, 90],
        [0, 100],
      ];
    }

    if (routeCount === 3) {
      return [
        [100, 0, 0],
        [80, 20, 0],
        [80, 10, 10],
        [70, 30, 0],
        [70, 20, 10],
        [70, 15, 15],
        [60, 40, 0],
        [60, 30, 10],
        [60, 20, 20],
        [50, 50, 0],
        [50, 40, 10],
        [50, 30, 20],
        [50, 25, 25],
        [40, 40, 20],
        [40, 30, 30],
        [34, 33, 33], // Equal split
      ];
    }

    // For 4+ routes, use simplified distributions
    const distributions: number[][] = [];

    // Equal split
    const equalPercent = Math.floor(100 / routeCount);
    const equalDist = new Array(routeCount).fill(equalPercent);
    equalDist[0] += 100 - equalPercent * routeCount; // Add remainder to first
    distributions.push(equalDist);

    // Weighted splits (70/30, 60/40, 50/50)
    for (const mainPercent of [70, 60, 50]) {
      const dist = new Array(routeCount).fill(0);
      dist[0] = mainPercent;
      const remaining = 100 - mainPercent;
      const otherPercent = Math.floor(remaining / (routeCount - 1));
      for (let i = 1; i < routeCount; i++) {
        dist[i] = otherPercent;
      }
      dist[1] += remaining - otherPercent * (routeCount - 1); // Add remainder
      distributions.push(dist);
    }

    return distributions;
  }

  /**
   * Create equal distribution
   */
  private static createEqualDistribution(count: number): number[] {
    const percent = Math.floor(100 / count);
    const distribution = new Array(count).fill(percent);
    distribution[0] += 100 - percent * count; // Add remainder to first
    return distribution;
  }

  /**
   * Generate neighboring distributions for gradient descent
   */
  private static generateNeighbors(percentages: number[]): number[][] {
    const neighbors: number[][] = [];
    const step = 5; // 5% steps

    for (let i = 0; i < percentages.length; i++) {
      for (let j = 0; j < percentages.length; j++) {
        if (i === j) continue;

        // Transfer step% from j to i
        if (percentages[j] >= step) {
          const neighbor = [...percentages];
          neighbor[i] += step;
          neighbor[j] -= step;
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Evaluate a distribution
   */
  private static evaluateDistribution(
    routes: Route[],
    totalAmount: bigint,
    percentages: number[]
  ): SplitDistribution | null {
    if (routes.length !== percentages.length) {
      return null;
    }

    // Validate percentages sum to 100
    const sum = percentages.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      return null;
    }

    try {
      // Calculate amounts for each route
      const amounts: bigint[] = [];
      let remainingAmount = totalAmount;

      for (let i = 0; i < percentages.length - 1; i++) {
        const amount = (totalAmount * BigInt(Math.floor(percentages[i] * 100))) / 10000n;
        amounts.push(amount);
        remainingAmount -= amount;
      }
      amounts.push(remainingAmount); // Last route gets remainder

      // Calculate output for each route
      let totalOutput = 0n;
      let totalPriceImpact = 0;

      for (let i = 0; i < routes.length; i++) {
        if (amounts[i] === 0n) continue;

        // For simplification, estimate output proportionally
        const ratio = Number(amounts[i]) / Number(totalAmount);
        const estimatedOutput = BigInt(Math.floor(Number(routes[i].expectedOutput) * ratio));

        totalOutput += estimatedOutput;
        totalPriceImpact += routes[i].priceImpactBps * ratio;
      }

      return {
        percentages,
        expectedOutput: totalOutput,
        priceImpact: totalPriceImpact,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create split route from distribution
   */
  private static createSplitRoute(
    routes: Route[],
    totalAmount: bigint,
    percentages: number[]
  ): SplitRoute {
    // Calculate amounts
    const amounts: bigint[] = [];
    let remainingAmount = totalAmount;

    for (let i = 0; i < percentages.length - 1; i++) {
      const amount = (totalAmount * BigInt(Math.floor(percentages[i] * 100))) / 10000n;
      amounts.push(amount);
      remainingAmount -= amount;
    }
    amounts.push(remainingAmount);

    // Filter out zero amounts
    const activeIndices = amounts
      .map((amt, idx) => (amt > 0n ? idx : -1))
      .filter(idx => idx >= 0);

    const activeRoutes = activeIndices.map(i => routes[i]);
    const activeAmounts = activeIndices.map(i => amounts[i]);
    const activePercentages = activeIndices.map(i => percentages[i]);

    // Calculate total output and price impact
    let totalOutput = 0n;
    let totalPriceImpact = 0;

    for (let i = 0; i < activeRoutes.length; i++) {
      const ratio = Number(activeAmounts[i]) / Number(totalAmount);
      const estimatedOutput = BigInt(
        Math.floor(Number(activeRoutes[i].expectedOutput) * ratio)
      );
      totalOutput += estimatedOutput;
      totalPriceImpact += activeRoutes[i].priceImpactBps * ratio;
    }

    // Compare to best single route
    const bestSingleRoute = routes[0];
    const isBetter = totalOutput > bestSingleRoute.expectedOutput;

    return {
      routes: activeRoutes,
      amounts: activeAmounts,
      percentages: activePercentages,
      totalOutput,
      totalPriceImpactBps: Math.round(totalPriceImpact),
      isBetterThanSingleRoute: isBetter,
    };
  }
}
