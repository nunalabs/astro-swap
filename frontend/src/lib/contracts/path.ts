/**
 * Path Calculation Functions
 * Handles optimal swap path finding
 */

import { NATIVE_XLM_SAC, USDC_TESTNET_SAC } from '../constants/tokens';
import type { Token, Pool } from './types';

/**
 * Calculate optimal swap path
 * Direct path or through intermediate token (XLM, USDC)
 */
export function calculateOptimalPath(
  tokenIn: Token,
  tokenOut: Token,
  pools: Pool[]
): Token[] {
  // Try direct path
  const directPool = pools.find(
    p =>
      (p.token0.address === tokenIn.address && p.token1.address === tokenOut.address) ||
      (p.token1.address === tokenIn.address && p.token0.address === tokenOut.address)
  );

  if (directPool) {
    return [tokenIn, tokenOut];
  }

  // Try path through intermediate tokens
  const intermediateTokens = [NATIVE_XLM_SAC, USDC_TESTNET_SAC];

  for (const intermediate of intermediateTokens) {
    const pool1 = pools.find(
      p =>
        (p.token0.address === tokenIn.address && p.token1.address === intermediate) ||
        (p.token1.address === tokenIn.address && p.token0.address === intermediate)
    );

    const pool2 = pools.find(
      p =>
        (p.token0.address === intermediate && p.token1.address === tokenOut.address) ||
        (p.token1.address === intermediate && p.token0.address === tokenOut.address)
    );

    if (pool1 && pool2) {
      const intermediateToken = pools
        .flatMap(p => [p.token0, p.token1])
        .find(t => t.address === intermediate);

      if (intermediateToken) {
        return [tokenIn, intermediateToken, tokenOut];
      }
    }
  }

  // No path found - return direct (will fail if no liquidity)
  return [tokenIn, tokenOut];
}
