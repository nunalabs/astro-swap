/**
 * useSwapQuote Hook
 * Handles swap quote fetching with React Query
 */

import { useQuery } from '@tanstack/react-query';
import { getAmountsOut, calculateOptimalPath, getPairAddress, getReservesForPair } from '../lib/contracts';
import { calculatePriceImpact, parseTokenAmount, formatTokenAmount } from '../lib/utils';
import { validateReserveFreshness } from '../lib/reserve-staleness';
import { DUMMY_SIMULATION_ADDRESS } from '../lib/constants';
import type { Token } from '../types';

export interface SwapQuoteData {
  amountOut: string;
  rawAmountIn: string;
  rawAmountOut: string;
  priceImpact: number;
  path: Token[];
  timestamp: number;
}

interface UseSwapQuoteOptions {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  walletAddress: string | null;
}

export function useSwapQuote({ tokenIn, tokenOut, amountIn, walletAddress }: UseSwapQuoteOptions) {
  const address = walletAddress || DUMMY_SIMULATION_ADDRESS;

  const query = useQuery({
    queryKey: ['swap-quote', tokenIn?.address, tokenOut?.address, amountIn],
    queryFn: async (): Promise<SwapQuoteData | null> => {
      if (!tokenIn || !tokenOut || !amountIn || !address) return null;

      const rawAmountIn = parseTokenAmount(amountIn, tokenIn.decimals);
      const path = calculateOptimalPath(tokenIn, tokenOut, []);
      const pathAddresses = path.map((t) => t.address);
      const amounts = await getAmountsOut(rawAmountIn, pathAddresses, address);

      if (!amounts || amounts.length === 0) return null;

      const rawOutputAmount = amounts[amounts.length - 1];
      const outputAmount = formatTokenAmount(rawOutputAmount, tokenOut.decimals, 7);

      let impact = 0;
      try {
        const firstPairAddress = await getPairAddress(path[0].address, path[1].address, address);

        if (firstPairAddress) {
          const reservesData = await getReservesForPair(
            firstPairAddress,
            path[0].address,
            path[1].address,
            address
          );

          if (reservesData) {
            const stalenessError = validateReserveFreshness(reservesData, 'price impact');
            if (stalenessError) {
              console.warn('⚠️ Reserve data is stale:', stalenessError);
            }

            impact = calculatePriceImpact(reservesData.reserveA, reservesData.reserveB, rawAmountIn);
            console.log('✅ Price impact calculated:', {
              reserveIn: reservesData.reserveA,
              reserveOut: reservesData.reserveB,
              impact: `${(impact * 100).toFixed(2)}%`,
            });
          }
        }
      } catch (error) {
        console.error('❌ Error calculating price impact:', error);
      }

      return {
        amountOut: outputAmount,
        rawAmountIn,
        rawAmountOut: rawOutputAmount,
        priceImpact: impact,
        path,
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
  };
}
