/**
 * useSwapQuote Hook
 *
 * Fetches swap quotes using the pool graph for real multi-hop routing.
 * Uses DFS pathfinder with dynamic per-hop fees from actual pair contracts.
 * Compares Soroban AMM vs Stellar Classic (SOR) when both are available.
 * Falls back to direct pair quote when pool graph is unavailable.
 */

import { useQuery } from '@tanstack/react-query';
import { getAmountsOut, getPairAddress, getReservesForPair } from '../lib/contracts';
import { findBestRoute } from '../lib/contracts/path';
import { selectBestVenue, type SwapVenue } from '../lib/contracts/sor';
import { usePoolGraph } from './usePoolGraph';
import { useHorizonPathQuote } from './useHorizonPathQuote';
import { calculatePriceImpact, parseTokenAmount, formatTokenAmount } from '../lib/utils';
import { validateReserveFreshness } from '../lib/reserve-staleness';
import { DUMMY_SIMULATION_ADDRESS } from '../lib/constants';
import type { Token } from '../types';
import type { BestRoute } from '../lib/contracts/path';

export interface SwapQuoteData {
  amountOut: string;
  rawAmountIn: string;
  rawAmountOut: string;
  priceImpact: number;
  /** Token objects for the route (UI display + transaction) */
  path: Token[];
  /** Per-hop fees from the pathfinder */
  feeBpsPerHop: number[];
  /** Full route details from DFS pathfinder (null if fallback used) */
  bestRoute: BestRoute | null;
  /** Selected execution venue */
  venue: SwapVenue;
  /** SOR improvement in bps (0 if no venue switch) */
  venueImprovementBps: number;
  timestamp: number;
}

interface UseSwapQuoteOptions {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  walletAddress: string | null;
}

/**
 * Build Token[] path from BestRoute addresses.
 */
function buildTokenPath(
  bestRoute: BestRoute,
  tokenIn: Token,
  tokenOut: Token
): Token[] {
  return bestRoute.path.map((addr, i) => {
    if (i === 0) return tokenIn;
    if (i === bestRoute.path.length - 1) return tokenOut;
    return {
      address: addr,
      symbol: addr.slice(0, 4) + '...' + addr.slice(-4),
      name: 'Intermediate',
      decimals: 7,
    };
  });
}

export function useSwapQuote({ tokenIn, tokenOut, amountIn, walletAddress }: UseSwapQuoteOptions) {
  const address = walletAddress || DUMMY_SIMULATION_ADDRESS;
  const { data: pools } = usePoolGraph();

  // Horizon quote (runs in parallel, only for SAC-mapped tokens)
  const { horizonQuote, canUseHorizon } = useHorizonPathQuote({
    tokenIn,
    tokenOut,
    amountIn,
  });

  const query = useQuery({
    queryKey: [
      'swap-quote',
      tokenIn?.address,
      tokenOut?.address,
      amountIn,
      pools?.length ?? 0,
      horizonQuote?.destinationAmount ?? null,
    ],
    queryFn: async (): Promise<SwapQuoteData | null> => {
      if (!tokenIn || !tokenOut || !amountIn || !address) return null;

      const rawAmountIn = parseTokenAmount(amountIn, tokenIn.decimals);
      const amountInBigInt = BigInt(rawAmountIn);

      let sorobanAmountOut: string | null = null;
      let sorobanRoute: BestRoute | null = null;
      let sorobanPath: Token[] = [tokenIn, tokenOut];
      let sorobanFeeBps: number[] = [30];
      let sorobanImpact = 0;

      // --- Try DFS pathfinder with real pool data ---
      if (pools && pools.length > 0) {
        const bestRoute = findBestRoute(
          tokenIn.address,
          tokenOut.address,
          amountInBigInt,
          pools
        );

        if (bestRoute && bestRoute.amountOut > 0n) {
          sorobanAmountOut = bestRoute.amountOut.toString();
          sorobanRoute = bestRoute;
          sorobanPath = buildTokenPath(bestRoute, tokenIn, tokenOut);
          sorobanFeeBps = bestRoute.feeBpsPerHop;
          sorobanImpact = bestRoute.priceImpactBps / 10000;
        }
      }

      // --- Fallback: direct pair via RPC (no pool graph) ---
      if (!sorobanAmountOut) {
        const directPath = [tokenIn.address, tokenOut.address];
        const amounts = await getAmountsOut(rawAmountIn, directPath, address);

        if (amounts && amounts.length > 0) {
          sorobanAmountOut = amounts[amounts.length - 1];

          try {
            const pairAddr = await getPairAddress(tokenIn.address, tokenOut.address, address);
            if (pairAddr) {
              const reserves = await getReservesForPair(pairAddr, tokenIn.address, tokenOut.address, address);
              if (reserves) {
                validateReserveFreshness(reserves, 'price impact');
                sorobanImpact = calculatePriceImpact(reserves.reserveA, reserves.reserveB, rawAmountIn);
              }
            }
          } catch {
            // Price impact unavailable; proceed without it
          }
        }
      }

      // --- SOR: compare Soroban vs Horizon Classic ---
      const classicAmountOut = horizonQuote?.destinationAmount ?? null;
      const sor = selectBestVenue(sorobanAmountOut, classicAmountOut);

      // Use the selected venue's output
      const finalAmountOut = sor.amountOut;
      if (finalAmountOut === '0') return null;

      const outputAmount = formatTokenAmount(finalAmountOut, tokenOut.decimals, 7);

      return {
        amountOut: outputAmount,
        rawAmountIn,
        rawAmountOut: finalAmountOut,
        priceImpact: sorobanImpact,
        path: sorobanPath,
        feeBpsPerHop: sorobanFeeBps,
        bestRoute: sorobanRoute,
        venue: sor.venue,
        venueImprovementBps: sor.improvementBps,
        timestamp: Date.now(),
      };
    },
    enabled: !!tokenIn && !!tokenOut && !!amountIn && parseFloat(amountIn) > 0 && !!address,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    quoteData: query.data,
    isLoadingQuote: query.isLoading,
    refetchQuote: query.refetch,
    canUseHorizon,
  };
}
