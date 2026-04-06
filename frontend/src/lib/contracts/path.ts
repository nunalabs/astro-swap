/**
 * Path Calculation - DFS-based optimal route finding
 *
 * Builds an adjacency graph from pool data and finds the best
 * multi-hop swap path using depth-first search with backtracking.
 * Includes route quality scoring and split trade estimation.
 * All calculations are pure BigInt math - no RPC calls.
 */

import { NATIVE_XLM_SAC, USDC_TESTNET_SAC } from '../constants/tokens';
import type { PoolNode } from '../../hooks/usePoolGraph';

// ─── Types ───────────────────────────────────────────────────────────

export interface RouteHop {
  pairAddress: string;
  tokenIn: string;
  tokenOut: string;
  reserveIn: bigint;
  reserveOut: bigint;
  feeBps: number;
  amountIn: bigint;
  amountOut: bigint;
}

export interface BestRoute {
  /** Token addresses: [tokenIn, ...intermediates, tokenOut] */
  path: string[];
  /** Per-hop details including reserves and fees */
  hops: RouteHop[];
  /** Final output amount */
  amountOut: bigint;
  /** Fee bps for each hop */
  feeBpsPerHop: number[];
  /** Cumulative price impact in bps */
  priceImpactBps: number;
  /** Route quality score (higher = better). Factors: output, impact, hop count */
  score: number;
}

export interface SplitEstimate {
  /** Whether splitting improves output vs single best route */
  isBetter: boolean;
  /** Estimated total output from split */
  totalOutput: bigint;
  /** Output improvement in bps vs single route */
  improvementBps: number;
  /** Routes and their percentage allocations */
  legs: Array<{ route: BestRoute; percent: number; amount: bigint }>;
}

interface GraphEdge {
  neighbor: string;
  pool: PoolNode;
}

// ─── Constants ───────────────────────────────────────────────────────

const MAX_HOPS = 3;
const BPS = 10000n;
/** Hop penalty factor: each additional hop reduces score by 5% */
const HOP_PENALTY = 0.95;

/** Well-known intermediary tokens for routing */
const INTERMEDIARY_TOKENS = [NATIVE_XLM_SAC, USDC_TESTNET_SAC];

// ─── AMM Math (pure functions) ───────────────────────────────────────

/**
 * Constant product AMM formula with fee
 */
function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const fee = BigInt(feeBps);
  const amountInWithFee = amountIn * (BPS - fee);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * BPS + amountInWithFee;
  return numerator / denominator;
}

/**
 * Calculate price impact for a single hop in basis points
 */
function calculateHopImpactBps(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  amountOut: bigint,
  feeBps: number
): number {
  if (reserveIn === 0n || amountIn === 0n) return 0;
  const feeMultiplier = BPS - BigInt(feeBps);
  const idealOut = (amountIn * feeMultiplier * reserveOut) / (reserveIn * BPS);
  if (idealOut === 0n) return 0;
  const diff = idealOut > amountOut ? idealOut - amountOut : 0n;
  return Number((diff * BPS) / idealOut);
}

// ─── Route Scoring ──────────────────────────────────────────────────

/**
 * Calculate route quality score.
 * Combines output ratio, price impact penalty, and hop penalty.
 * Higher score = better route.
 */
function calculateRouteScore(
  amountIn: bigint,
  amountOut: bigint,
  priceImpactBps: number,
  hopCount: number
): number {
  if (amountIn === 0n) return 0;
  const outputRatio = Number(amountOut) / Number(amountIn);
  const impactPenalty = Math.max(0, 1 - priceImpactBps / 10000);
  const hopsPenalty = Math.pow(HOP_PENALTY, hopCount - 1);
  return outputRatio * impactPenalty * hopsPenalty;
}

// ─── Graph Builder ───────────────────────────────────────────────────

function buildGraph(pools: PoolNode[]): Map<string, GraphEdge[]> {
  const graph = new Map<string, GraphEdge[]>();

  for (const pool of pools) {
    const t0 = pool.token0;
    const t1 = pool.token1;

    if (!graph.has(t0)) graph.set(t0, []);
    if (!graph.has(t1)) graph.set(t1, []);

    graph.get(t0)!.push({ neighbor: t1, pool });
    graph.get(t1)!.push({ neighbor: t0, pool });
  }

  return graph;
}

// ─── DFS Core ───────────────────────────────────────────────────────

/**
 * Shared DFS traversal. Calls `onRoute` for every valid path found.
 */
function dfsTraverse(
  graph: Map<string, GraphEdge[]>,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  maxHops: number,
  onRoute: (route: BestRoute) => void
): void {
  const visited = new Set<string>();

  function dfs(
    current: string,
    currentAmount: bigint,
    path: string[],
    hops: RouteHop[],
    totalImpactBps: number
  ): void {
    if (current === tokenOut && hops.length > 0) {
      const score = calculateRouteScore(amountIn, currentAmount, totalImpactBps, hops.length);
      onRoute({
        path: [...path],
        hops: [...hops],
        amountOut: currentAmount,
        feeBpsPerHop: hops.map((h) => h.feeBps),
        priceImpactBps: totalImpactBps,
        score,
      });
      return;
    }

    if (hops.length >= maxHops) return;

    const edges = graph.get(current);
    if (!edges) return;

    visited.add(current);

    for (const { neighbor, pool } of edges) {
      if (visited.has(neighbor)) continue;

      const isToken0In = current === pool.token0;
      const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
      const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;

      if (reserveIn === 0n || reserveOut === 0n) continue;

      const amtOut = getAmountOut(currentAmount, reserveIn, reserveOut, pool.feeBps);
      if (amtOut === 0n) continue;

      const hopImpact = calculateHopImpactBps(
        currentAmount, reserveIn, reserveOut, amtOut, pool.feeBps
      );

      const hop: RouteHop = {
        pairAddress: pool.pairAddress,
        tokenIn: current,
        tokenOut: neighbor,
        reserveIn,
        reserveOut,
        feeBps: pool.feeBps,
        amountIn: currentAmount,
        amountOut: amtOut,
      };

      dfs(
        neighbor,
        amtOut,
        [...path, neighbor],
        [...hops, hop],
        totalImpactBps + hopImpact
      );
    }

    visited.delete(current);
  }

  dfs(tokenIn, amountIn, [tokenIn], [], 0);
}

// ─── DFS Path Finder ─────────────────────────────────────────────────

/**
 * Find the optimal swap path using DFS with backtracking.
 * Returns the single route with the highest quality score.
 */
export function calculateOptimalPath(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  pools: PoolNode[],
  maxHops = MAX_HOPS
): BestRoute | null {
  if (pools.length === 0 || amountIn <= 0n) return null;
  if (tokenIn === tokenOut) return null;

  const graph = buildGraph(pools);
  if (!graph.has(tokenIn)) return null;

  let best: BestRoute | null = null;

  dfsTraverse(graph, tokenIn, tokenOut, amountIn, maxHops, (route) => {
    if (!best || route.score > best.score) {
      best = route;
    }
  });

  return best;
}

/**
 * Find ALL valid routes between two tokens (for split optimization).
 * Returns routes sorted by score, up to `limit`.
 */
export function findAllRoutes(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  pools: PoolNode[],
  maxHops = MAX_HOPS,
  limit = 5
): BestRoute[] {
  if (pools.length === 0 || amountIn <= 0n) return [];
  if (tokenIn === tokenOut) return [];

  const graph = buildGraph(pools);
  if (!graph.has(tokenIn)) return [];

  const routes: BestRoute[] = [];

  dfsTraverse(graph, tokenIn, tokenOut, amountIn, maxHops, (route) => {
    routes.push(route);
  });

  routes.sort((a, b) => b.score - a.score);
  return routes.slice(0, limit);
}

// ─── Split Trade Estimator ──────────────────────────────────────────

/**
 * Estimate whether splitting a trade across multiple routes yields better output.
 * Re-runs AMM math for each split portion (not proportional estimation).
 * Only beneficial for large trades with high price impact.
 */
export function estimateSplit(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  pools: PoolNode[],
  maxSplits = 3
): SplitEstimate | null {
  const allRoutes = findAllRoutes(tokenIn, tokenOut, amountIn, pools, MAX_HOPS, maxSplits);
  if (allRoutes.length < 2) return null;

  const bestSingle = allRoutes[0];

  // Try 50/50 split across top 2 routes
  const splits = [
    [50, 50],
    [60, 40],
    [70, 30],
  ];

  let bestSplit: SplitEstimate | null = null;

  for (const [pctA, pctB] of splits) {
    const amountA = (amountIn * BigInt(pctA)) / 100n;
    const amountB = amountIn - amountA;

    // Re-calculate each route with actual split amounts
    const routeA = recalculateRoute(allRoutes[0], amountA, pools);
    const routeB = recalculateRoute(allRoutes[1], amountB, pools);

    if (!routeA || !routeB) continue;

    const totalOutput = routeA.amountOut + routeB.amountOut;

    if (totalOutput <= bestSingle.amountOut) continue;

    const improvementBps = bestSingle.amountOut > 0n
      ? Number(((totalOutput - bestSingle.amountOut) * BPS) / bestSingle.amountOut)
      : 0;

    if (!bestSplit || totalOutput > bestSplit.totalOutput) {
      bestSplit = {
        isBetter: true,
        totalOutput,
        improvementBps,
        legs: [
          { route: routeA, percent: pctA, amount: amountA },
          { route: routeB, percent: pctB, amount: amountB },
        ],
      };
    }
  }

  return bestSplit;
}

/**
 * Recalculate a route with a different input amount.
 * Uses the same path but re-runs AMM math with fresh reserves.
 */
function recalculateRoute(
  original: BestRoute,
  newAmountIn: bigint,
  pools: PoolNode[]
): BestRoute | null {
  if (newAmountIn <= 0n) return null;

  let currentAmount = newAmountIn;
  const hops: RouteHop[] = [];
  let totalImpact = 0;

  for (const origHop of original.hops) {
    // Find the pool for this hop
    const pool = pools.find((p) => p.pairAddress === origHop.pairAddress);
    if (!pool) return null;

    const isToken0In = origHop.tokenIn === pool.token0;
    const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
    const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;

    if (reserveIn === 0n || reserveOut === 0n) return null;

    const amtOut = getAmountOut(currentAmount, reserveIn, reserveOut, pool.feeBps);
    if (amtOut === 0n) return null;

    const hopImpact = calculateHopImpactBps(
      currentAmount, reserveIn, reserveOut, amtOut, pool.feeBps
    );

    hops.push({
      pairAddress: pool.pairAddress,
      tokenIn: origHop.tokenIn,
      tokenOut: origHop.tokenOut,
      reserveIn,
      reserveOut,
      feeBps: pool.feeBps,
      amountIn: currentAmount,
      amountOut: amtOut,
    });

    totalImpact += hopImpact;
    currentAmount = amtOut;
  }

  const score = calculateRouteScore(newAmountIn, currentAmount, totalImpact, hops.length);

  return {
    path: original.path,
    hops,
    amountOut: currentAmount,
    feeBpsPerHop: hops.map((h) => h.feeBps),
    priceImpactBps: totalImpact,
    score,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Find route with fallback to intermediary tokens.
 * First tries DFS, then tries forced 2-hop routes through known intermediaries.
 */
export function findBestRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  pools: PoolNode[],
  maxHops = MAX_HOPS
): BestRoute | null {
  // Try full DFS first
  const dfsRoute = calculateOptimalPath(tokenIn, tokenOut, amountIn, pools, maxHops);

  if (dfsRoute) return dfsRoute;

  // Fallback: try forced 2-hop through intermediaries, pick the best
  let bestFallback: BestRoute | null = null;

  for (const intermediate of INTERMEDIARY_TOKENS) {
    if (intermediate === tokenIn || intermediate === tokenOut) continue;

    const poolIn = pools.find(
      (p) =>
        (p.token0 === tokenIn && p.token1 === intermediate) ||
        (p.token1 === tokenIn && p.token0 === intermediate)
    );

    const poolOut = pools.find(
      (p) =>
        (p.token0 === intermediate && p.token1 === tokenOut) ||
        (p.token1 === intermediate && p.token0 === tokenOut)
    );

    if (!poolIn || !poolOut) continue;

    const isToken0InFirst = tokenIn === poolIn.token0;
    const r0In = isToken0InFirst ? poolIn.reserve0 : poolIn.reserve1;
    const r0Out = isToken0InFirst ? poolIn.reserve1 : poolIn.reserve0;

    const midAmount = getAmountOut(amountIn, r0In, r0Out, poolIn.feeBps);
    if (midAmount === 0n) continue;

    const isToken0InSecond = intermediate === poolOut.token0;
    const r1In = isToken0InSecond ? poolOut.reserve0 : poolOut.reserve1;
    const r1Out = isToken0InSecond ? poolOut.reserve1 : poolOut.reserve0;

    const finalAmount = getAmountOut(midAmount, r1In, r1Out, poolOut.feeBps);
    if (finalAmount === 0n) continue;

    const impact0 = calculateHopImpactBps(amountIn, r0In, r0Out, midAmount, poolIn.feeBps);
    const impact1 = calculateHopImpactBps(midAmount, r1In, r1Out, finalAmount, poolOut.feeBps);
    const totalImpact = impact0 + impact1;
    const score = calculateRouteScore(amountIn, finalAmount, totalImpact, 2);

    if (bestFallback && score <= bestFallback.score) continue;

    bestFallback = {
      path: [tokenIn, intermediate, tokenOut],
      hops: [
        {
          pairAddress: poolIn.pairAddress,
          tokenIn,
          tokenOut: intermediate,
          reserveIn: r0In,
          reserveOut: r0Out,
          feeBps: poolIn.feeBps,
          amountIn,
          amountOut: midAmount,
        },
        {
          pairAddress: poolOut.pairAddress,
          tokenIn: intermediate,
          tokenOut,
          reserveIn: r1In,
          reserveOut: r1Out,
          feeBps: poolOut.feeBps,
          amountIn: midAmount,
          amountOut: finalAmount,
        },
      ],
      amountOut: finalAmount,
      feeBpsPerHop: [poolIn.feeBps, poolOut.feeBps],
      priceImpactBps: totalImpact,
      score,
    };
  }

  return bestFallback;
}
