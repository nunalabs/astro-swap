/**
 * useHorizonPathQuote Hook
 *
 * Queries Stellar Horizon /paths/strict-send to get quotes from
 * the classic SDEX orderbook + Protocol 18 AMM pools.
 * Only works for tokens with known Stellar Asset Contract (SAC) mappings.
 *
 * This enables Smart Order Routing: compare Soroban AMM vs Stellar Classic
 * and execute through the venue offering better rates.
 */

import { useQuery } from '@tanstack/react-query';
import { STELLAR_HORIZON_URL } from '../lib/constants/network';
import { NATIVE_XLM_SAC, USDC_TESTNET_SAC } from '../lib/constants/tokens';
import { parseTokenAmount } from '../lib/utils';
import type { Token } from '../types';

// ─── SAC → Stellar Asset Mapping ────────────────────────────────────

interface StellarAsset {
  code: string;
  issuer?: string; // undefined = native XLM
}

/**
 * Known mappings from Soroban SAC address → Stellar classic asset.
 * Only tokens with SAC (Stellar Asset Contract) wrappers can be routed
 * through Horizon. Soroban-native tokens have no classic equivalent.
 */
const SAC_TO_ASSET: Record<string, StellarAsset> = {
  [NATIVE_XLM_SAC]: { code: 'XLM' },
  [USDC_TESTNET_SAC]: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
};

// ─── Types ───────────────────────────────────────────────────────────

export interface HorizonPathQuote {
  /** Output amount as raw string (stroops) */
  destinationAmount: string;
  /** Path of intermediate assets */
  path: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
  /** Source asset */
  sourceAsset: StellarAsset;
  /** Destination asset */
  destinationAsset: StellarAsset;
}

interface UseHorizonPathQuoteOptions {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  enabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function assetToQueryParam(asset: StellarAsset): string {
  if (!asset.issuer) return 'native';
  return `${asset.code}:${asset.issuer}`;
}

function assetToUrlParams(prefix: string, asset: StellarAsset): string {
  if (!asset.issuer) {
    return `${prefix}_asset_type=native`;
  }
  return `${prefix}_asset_type=credit_alphanum${asset.code.length <= 4 ? '4' : '12'}&${prefix}_asset_code=${asset.code}&${prefix}_asset_issuer=${asset.issuer}`;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useHorizonPathQuote({
  tokenIn,
  tokenOut,
  amountIn,
  enabled = true,
}: UseHorizonPathQuoteOptions) {
  const sourceAsset = tokenIn ? SAC_TO_ASSET[tokenIn.address] : undefined;
  const destAsset = tokenOut ? SAC_TO_ASSET[tokenOut.address] : undefined;

  const canUseHorizon = !!sourceAsset && !!destAsset;

  const query = useQuery({
    queryKey: ['horizon-path-quote', tokenIn?.address, tokenOut?.address, amountIn],
    queryFn: async (): Promise<HorizonPathQuote | null> => {
      if (!tokenIn || !tokenOut || !amountIn || !sourceAsset || !destAsset) return null;

      const rawAmount = parseTokenAmount(amountIn, tokenIn.decimals);
      // Horizon expects amount in decimal (e.g., "10.0000000" for 10 XLM)
      const decimalAmount = (Number(rawAmount) / Math.pow(10, tokenIn.decimals)).toFixed(tokenIn.decimals);

      const sourceParams = assetToUrlParams('source', sourceAsset);
      const destParams = assetToUrlParams('destination', destAsset);

      const url = `${STELLAR_HORIZON_URL}/paths/strict-send?${sourceParams}&source_amount=${decimalAmount}&${destParams}`;

      try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        const records = data._embedded?.records;
        if (!records || records.length === 0) return null;

        // Horizon returns multiple paths; pick the one with highest destination_amount
        let best = records[0];
        for (const record of records) {
          if (parseFloat(record.destination_amount) > parseFloat(best.destination_amount)) {
            best = record;
          }
        }

        // Convert decimal amount back to raw
        const destRaw = Math.floor(parseFloat(best.destination_amount) * Math.pow(10, tokenOut.decimals)).toString();

        return {
          destinationAmount: destRaw,
          path: best.path || [],
          sourceAsset,
          destinationAsset: destAsset,
        };
      } catch {
        return null;
      }
    },
    enabled: enabled && canUseHorizon && !!tokenIn && !!tokenOut && !!amountIn && parseFloat(amountIn) > 0,
    staleTime: 15000,
    retry: 1,
  });

  return {
    horizonQuote: query.data,
    isLoadingHorizon: query.isLoading,
    canUseHorizon,
  };
}

/**
 * Check if a token address has a known SAC mapping for Horizon routing
 */
export function hasSacMapping(address: string): boolean {
  return address in SAC_TO_ASSET;
}

export { SAC_TO_ASSET, assetToQueryParam };
export type { StellarAsset };
