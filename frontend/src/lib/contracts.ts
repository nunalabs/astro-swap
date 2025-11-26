import * as StellarSdk from '@stellar/stellar-sdk';
import { callContract, buildAndSubmitTransaction } from './stellar';
import type { Pool, Token } from '../types';

// Contract addresses (set via environment variables)
export const CONTRACTS = {
  FACTORY: import.meta.env.VITE_FACTORY_CONTRACT_ID || '',
  ROUTER: import.meta.env.VITE_ROUTER_CONTRACT_ID || '',
  STAKING: import.meta.env.VITE_STAKING_CONTRACT_ID || '',
  AGGREGATOR: import.meta.env.VITE_AGGREGATOR_CONTRACT_ID || '',
  BRIDGE: import.meta.env.VITE_BRIDGE_CONTRACT_ID || '',
};

/**
 * Factory Contract - Get all pairs
 */
export async function getAllPairs(sourceAddress: string): Promise<string[]> {
  try {
    const result = await callContract(
      CONTRACTS.FACTORY,
      'get_all_pairs',
      [],
      sourceAddress
    );
    return result as string[];
  } catch (error) {
    console.error('Error getting all pairs:', error);
    return [];
  }
}

/**
 * Factory Contract - Get pair address
 */
export async function getPairAddress(
  token0: string,
  token1: string,
  sourceAddress: string
): Promise<string | null> {
  try {
    const token0ScVal = StellarSdk.nativeToScVal(token0, { type: 'address' });
    const token1ScVal = StellarSdk.nativeToScVal(token1, { type: 'address' });

    const result = await callContract(
      CONTRACTS.FACTORY,
      'get_pair',
      [token0ScVal, token1ScVal],
      sourceAddress
    );

    return result as string;
  } catch (error) {
    console.error('Error getting pair address:', error);
    return null;
  }
}

/**
 * Pair Contract - Get reserves
 */
export async function getReserves(
  pairAddress: string,
  sourceAddress: string
): Promise<{ reserve0: string; reserve1: string; blockTimestampLast: number } | null> {
  try {
    const result = await callContract(
      pairAddress,
      'get_reserves',
      [],
      sourceAddress
    );

    return result as { reserve0: string; reserve1: string; blockTimestampLast: number };
  } catch (error) {
    console.error('Error getting reserves:', error);
    return null;
  }
}

/**
 * Router Contract - Get amounts out for exact input
 */
export async function getAmountsOut(
  amountIn: string,
  path: string[],
  sourceAddress: string
): Promise<string[]> {
  try {
    const amountInScVal = StellarSdk.nativeToScVal(amountIn, { type: 'u128' });
    const pathScVal = StellarSdk.nativeToScVal(
      path.map(addr => ({ type: 'address', value: addr })),
      { type: 'vec' }
    );

    const result = await callContract(
      CONTRACTS.ROUTER,
      'get_amounts_out',
      [amountInScVal, pathScVal],
      sourceAddress
    );

    return result as string[];
  } catch (error) {
    console.error('Error getting amounts out:', error);
    return [];
  }
}

/**
 * Router Contract - Swap exact tokens for tokens
 */
export async function swapExactTokensForTokens(
  amountIn: string,
  amountOutMin: string,
  path: string[],
  to: string,
  deadline: number,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

    const amountInScVal = StellarSdk.nativeToScVal(amountIn, { type: 'u128' });
    const amountOutMinScVal = StellarSdk.nativeToScVal(amountOutMin, { type: 'u128' });
    const pathScVal = StellarSdk.nativeToScVal(
      path.map(addr => ({ type: 'address', value: addr })),
      { type: 'vec' }
    );
    const toScVal = StellarSdk.nativeToScVal(to, { type: 'address' });
    const deadlineScVal = StellarSdk.nativeToScVal(deadline, { type: 'u64' });

    const operation = contract.call(
      'swap_exact_tokens_for_tokens',
      amountInScVal,
      amountOutMinScVal,
      pathScVal,
      toScVal,
      deadlineScVal
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error swapping tokens:', error);
    throw error;
  }
}

/**
 * Router Contract - Add liquidity
 */
export async function addLiquidity(
  tokenA: string,
  tokenB: string,
  amountADesired: string,
  amountBDesired: string,
  amountAMin: string,
  amountBMin: string,
  to: string,
  deadline: number,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

    const operation = contract.call(
      'add_liquidity',
      StellarSdk.nativeToScVal(tokenA, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenB, { type: 'address' }),
      StellarSdk.nativeToScVal(amountADesired, { type: 'u128' }),
      StellarSdk.nativeToScVal(amountBDesired, { type: 'u128' }),
      StellarSdk.nativeToScVal(amountAMin, { type: 'u128' }),
      StellarSdk.nativeToScVal(amountBMin, { type: 'u128' }),
      StellarSdk.nativeToScVal(to, { type: 'address' }),
      StellarSdk.nativeToScVal(deadline, { type: 'u64' })
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error adding liquidity:', error);
    throw error;
  }
}

/**
 * Router Contract - Remove liquidity
 */
export async function removeLiquidity(
  tokenA: string,
  tokenB: string,
  liquidity: string,
  amountAMin: string,
  amountBMin: string,
  to: string,
  deadline: number,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

    const operation = contract.call(
      'remove_liquidity',
      StellarSdk.nativeToScVal(tokenA, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenB, { type: 'address' }),
      StellarSdk.nativeToScVal(liquidity, { type: 'u128' }),
      StellarSdk.nativeToScVal(amountAMin, { type: 'u128' }),
      StellarSdk.nativeToScVal(amountBMin, { type: 'u128' }),
      StellarSdk.nativeToScVal(to, { type: 'address' }),
      StellarSdk.nativeToScVal(deadline, { type: 'u64' })
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error removing liquidity:', error);
    throw error;
  }
}

/**
 * Staking Contract - Stake LP tokens
 */
export async function stake(
  poolId: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'stake',
      StellarSdk.nativeToScVal(poolId, { type: 'u128' }),
      StellarSdk.nativeToScVal(amount, { type: 'u128' })
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error staking:', error);
    throw error;
  }
}

/**
 * Staking Contract - Unstake LP tokens
 */
export async function unstake(
  poolId: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'unstake',
      StellarSdk.nativeToScVal(poolId, { type: 'u128' }),
      StellarSdk.nativeToScVal(amount, { type: 'u128' })
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error unstaking:', error);
    throw error;
  }
}

/**
 * Staking Contract - Claim rewards
 */
export async function claimRewards(
  poolId: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'claim_rewards',
      StellarSdk.nativeToScVal(poolId, { type: 'u128' })
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
}

/**
 * Staking Contract - Get user stake info
 */
export async function getUserStakeInfo(
  poolId: string,
  userAddress: string,
  sourceAddress: string
): Promise<{ staked: string; rewards: string } | null> {
  try {
    const poolIdScVal = StellarSdk.nativeToScVal(poolId, { type: 'u128' });
    const userScVal = StellarSdk.nativeToScVal(userAddress, { type: 'address' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'get_user_info',
      [poolIdScVal, userScVal],
      sourceAddress
    );

    return result as { staked: string; rewards: string };
  } catch (error) {
    console.error('Error getting user stake info:', error);
    return null;
  }
}

/**
 * Token Contract - Approve spending
 */
export async function approveToken(
  tokenAddress: string,
  spender: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(tokenAddress);

    const operation = contract.call(
      'approve',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(spender, { type: 'address' }),
      StellarSdk.nativeToScVal(amount, { type: 'u128' }),
      StellarSdk.nativeToScVal(9999999999, { type: 'u64' }) // expiration
    );

    const txHash = await buildAndSubmitTransaction(sourceAddress, [operation]);
    return txHash;
  } catch (error) {
    console.error('Error approving token:', error);
    throw error;
  }
}

/**
 * Helper: Calculate optimal swap path
 */
export function calculateOptimalPath(
  tokenIn: Token,
  tokenOut: Token,
  pools: Pool[]
): Token[] {
  // Simple implementation: direct path or through intermediate token
  // In production, implement Dijkstra's algorithm for optimal routing

  // Try direct path
  const directPool = pools.find(
    p =>
      (p.token0.address === tokenIn.address && p.token1.address === tokenOut.address) ||
      (p.token1.address === tokenIn.address && p.token0.address === tokenOut.address)
  );

  if (directPool) {
    return [tokenIn, tokenOut];
  }

  // Try path through intermediate tokens (e.g., USDC, XLM)
  // This is a simplified version - implement proper pathfinding for production
  const intermediateTokens = ['USDC_ADDRESS', 'XLM_ADDRESS']; // Replace with actual addresses

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

  // No path found
  return [tokenIn, tokenOut];
}
