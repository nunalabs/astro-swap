import * as StellarSdk from '@stellar/stellar-sdk';
import { callContract, buildAndSubmitTransaction } from './stellar';
import { isValidContractId } from './utils';
import { NATIVE_XLM_SAC, USDC_TESTNET_SAC } from './constants/tokens';
import type { Pool, Token } from '../types';

/**
 * Staking contract types (raw contract responses)
 * These types match the Soroban contract return types
 */
export interface ContractStakingPool {
  pool_id: number;
  lp_token: string;
  reward_token: string;
  total_staked: bigint;
  reward_per_second: bigint;
  start_time: bigint;
  end_time: bigint;
  last_update_time: bigint;
  acc_reward_per_share: bigint;
}

export interface ContractUserStake {
  amount: bigint;
  reward_debt: bigint;
  stake_time: bigint;
  multiplier: number; // u32
}

// Contract addresses (set via environment variables)
export const CONTRACTS = {
  FACTORY: import.meta.env.VITE_FACTORY_CONTRACT_ID || '',
  ROUTER: import.meta.env.VITE_ROUTER_CONTRACT_ID || '',
  STAKING: import.meta.env.VITE_STAKING_CONTRACT_ID || '',
  AGGREGATOR: import.meta.env.VITE_AGGREGATOR_CONTRACT_ID || '',
  BRIDGE: import.meta.env.VITE_BRIDGE_CONTRACT_ID || '',
};

/**
 * Validate critical contract addresses on module load
 * Throws error if required contracts are missing or invalid
 */
function validateContracts() {
  const criticalContracts = [
    { name: 'FACTORY', address: CONTRACTS.FACTORY },
    { name: 'ROUTER', address: CONTRACTS.ROUTER },
  ];

  const errors: string[] = [];

  for (const { name, address } of criticalContracts) {
    if (!address) {
      errors.push(`Missing environment variable: VITE_${name}_CONTRACT_ID`);
    } else if (!isValidContractId(address)) {
      errors.push(
        `Invalid ${name} contract address: ${address}. Must start with 'C' and be 56 characters long.`
      );
    }
  }

  if (errors.length > 0) {
    const errorMessage = [
      '❌ Contract Configuration Error:',
      ...errors,
      '',
      'Please check your .env file and ensure all required contract addresses are set.',
    ].join('\n');

    console.error(errorMessage);

    // In development, show error in UI
    if (import.meta.env.DEV) {
      throw new Error(errorMessage);
    }
  }
}

// Validate contracts on module load
validateContracts();

/**
 * Factory Contract - Get all pairs using pagination
 * Factory contract uses get_pairs_paginated(start_index, limit) instead of get_all_pairs
 */
export async function getAllPairs(sourceAddress: string): Promise<string[]> {
  try {
    console.log('🔍 Fetching total pairs from factory:', CONTRACTS.FACTORY);

    // Get total number of pairs first
    const totalPairs = await callContract(
      CONTRACTS.FACTORY,
      'all_pairs_length',
      [],
      sourceAddress
    ) as number;

    console.log(`📊 Factory reports ${totalPairs} total pairs`);

    if (totalPairs === 0) {
      console.log('⚠️ No pairs exist in factory yet');
      return [];
    }

    // Fetch all pairs in one batch (max 100 per call)
    // If more than 100 pairs exist, fetch in multiple batches
    const allPairs: string[] = [];
    const batchSize = 100;

    for (let start = 0; start < totalPairs; start += batchSize) {
      const limit = Math.min(batchSize, totalPairs - start);
      console.log(`📥 Fetching pairs batch: start=${start}, limit=${limit}`);

      const startScVal = StellarSdk.nativeToScVal(start, { type: 'u32' });
      const limitScVal = StellarSdk.nativeToScVal(limit, { type: 'u32' });

      const batch = await callContract(
        CONTRACTS.FACTORY,
        'get_pairs_paginated',
        [startScVal, limitScVal],
        sourceAddress
      ) as string[];

      console.log(`✅ Received ${batch.length} pair addresses in batch`);

      allPairs.push(...batch);
    }

    return allPairs;
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

    console.log('🏭 Factory.get_pair result:', {
      token0: token0.substring(0, 8) + '...',
      token1: token1.substring(0, 8) + '...',
      pairAddress: result ? (result as string).substring(0, 8) + '...' : null,
      fullPairAddress: result,
    });

    return result as string;
  } catch (error) {
    console.error('Error getting pair address:', error);
    return null;
  }
}

/**
 * Pair Contract - Get reserves
 * Returns tuple (reserve0, reserve1) from Soroban as [i128, i128]
 */
export async function getReserves(
  pairAddress: string,
  sourceAddress: string
): Promise<{ reserve0: string; reserve1: string; timestamp: number } | null> {
  try {
    const result = await callContract(
      pairAddress,
      'get_reserves',
      [],
      sourceAddress
    );

    console.log('🔍 getReserves raw result:', {
      result,
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A',
      type: typeof result,
      constructor: result?.constructor?.name,
    });

    // Soroban returns tuple as array: [reserve0, reserve1]
    // Values come as BigInt from scValToNative
    if (Array.isArray(result) && result.length === 2) {
      const reserves = {
        reserve0: result[0]?.toString() || '0',
        reserve1: result[1]?.toString() || '0',
        timestamp: Date.now(), // W3-2: Add timestamp for staleness validation
      };
      console.log('✅ Parsed reserves:', reserves);
      return reserves;
    }

    console.warn('❌ Unexpected reserves format:', result);
    return null;
  } catch (error) {
    console.error('❌ Error getting reserves:', error);
    return null;
  }
}

/**
 * Pair Contract - Get total supply of LP tokens
 */
export async function getTotalSupply(
  pairAddress: string,
  sourceAddress: string
): Promise<string> {
  try {
    const result = await callContract(
      pairAddress,
      'total_supply',
      [],
      sourceAddress
    );

    return String(result);
  } catch (error) {
    console.error('Error getting total supply:', error);
    return '0';
  }
}

/**
 * Calculate amount out using constant product formula
 * amountOut = (amountIn * reserveOut * (10000 - fee)) / (reserveIn * 10000 + amountIn * (10000 - fee))
 *
 * Fee is 30 bps (0.3%) = 9970/10000 after fee
 */
function calculateAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps = 30n): bigint {
  if (reserveIn === 0n || reserveOut === 0n) return 0n;

  const amountInWithFee = amountIn * (10000n - feeBps);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;

  return numerator / denominator;
}

/**
 * CENTRALIZED HELPER: Get reserves with tokens matched correctly
 *
 * STRUCTURAL FIX FOR RESERVE ORDERING:
 * The pair contract stores tokens in SORTED order (lexicographically by address).
 * This function ensures reserves are ALWAYS matched to the correct tokens by:
 * 1. Fetching reserves AND token addresses from the contract
 * 2. Verifying which token is token_0 and which is token_1
 * 3. Returning reserves matched to the specified tokens
 *
 * USE THIS EVERYWHERE instead of calling getReserves() + assuming order!
 *
 * @param pairAddress - Address of the pair contract
 * @param tokenA - First token address (order doesn't matter)
 * @param tokenB - Second token address (order doesn't matter)
 * @param sourceAddress - User's address for simulation
 * @returns Object with reserveA and reserveB correctly matched to tokenA/tokenB,
 *          plus token0/token1 from contract for verification
 */
export async function getReservesForPair(
  pairAddress: string,
  tokenA: string,
  tokenB: string,
  sourceAddress: string
): Promise<{
  reserveA: string;
  reserveB: string;
  token0: string;
  token1: string;
  timestamp: number; // W3-2: Timestamp for staleness validation
} | null> {
  try {
    console.log('🔍 getReservesForPair called:', {
      pairAddress: pairAddress.slice(0, 8) + '...',
      tokenA: tokenA.slice(0, 8) + '...',
      tokenB: tokenB.slice(0, 8) + '...',
    });

    // Fetch reserves, token0, AND token1 in parallel
    const [reserves, token0, token1] = await Promise.all([
      getReserves(pairAddress, sourceAddress),
      callContract(pairAddress, 'token_0', [], sourceAddress) as Promise<string>,
      callContract(pairAddress, 'token_1', [], sourceAddress) as Promise<string>,
    ]);

    if (!reserves) {
      console.error('❌ Failed to fetch reserves');
      return null;
    }

    console.log('📊 Contract data:', {
      pairAddress: pairAddress.slice(0, 8) + '...',
      token0: token0.slice(0, 8) + '...',
      token1: token1.slice(0, 8) + '...',
      reserve0: reserves.reserve0,
      reserve1: reserves.reserve1,
    });

    // Determine which reserve corresponds to which token
    let reserveA: string;
    let reserveB: string;

    if (tokenA === token0 && tokenB === token1) {
      // tokenA is token0, tokenB is token1
      reserveA = reserves.reserve0;
      reserveB = reserves.reserve1;
      console.log('✅ tokenA=token0, tokenB=token1 → reserveA=reserve0, reserveB=reserve1');
    } else if (tokenA === token1 && tokenB === token0) {
      // tokenA is token1, tokenB is token0
      reserveA = reserves.reserve1;
      reserveB = reserves.reserve0;
      console.log('✅ tokenA=token1, tokenB=token0 → reserveA=reserve1, reserveB=reserve0');
    } else {
      console.error('❌ Token mismatch! Tokens do not match contract token0/token1:', {
        tokenA,
        tokenB,
        token0,
        token1,
      });
      return null;
    }

    console.log('✅ Final matched reserves:', {
      reserveA,
      reserveB,
    });

    // W3-2: Include timestamp from reserves for staleness validation
    return {
      reserveA,
      reserveB,
      token0,
      token1,
      timestamp: reserves.timestamp,
    };
  } catch (error) {
    console.error('❌ Error in getReservesForPair:', error);
    return null;
  }
}

/**
 * INTERNAL HELPER: Get reserves for swap calculations with correct ordering
 * Uses getReservesForPair() internally for consistency.
 */
async function getReservesForSwap(
  pairAddress: string,
  tokenIn: string,
  tokenOut: string,
  sourceAddress: string
): Promise<{ reserveIn: bigint; reserveOut: bigint } | null> {
  const result = await getReservesForPair(pairAddress, tokenIn, tokenOut, sourceAddress);

  if (!result) {
    return null;
  }

  return {
    reserveIn: BigInt(result.reserveA),
    reserveOut: BigInt(result.reserveB),
  };
}

/**
 * Get amounts out for a path - OPTIMIZED with batch RPC calls
 * Reduces N+1 query problem by fetching all pair data in parallel
 *
 * Performance: 3N sequential calls → 2 parallel batches
 * Example: 3-hop swap goes from 9 sequential to 6 parallel calls
 */
export async function getAmountsOut(
  amountIn: string,
  path: string[],
  sourceAddress: string
): Promise<string[]> {
  try {
    if (path.length < 2) {
      console.error('Path must have at least 2 tokens');
      return [];
    }

    // Step 1: Get all pair addresses in parallel (1 batch)
    const pairPromises = [];
    for (let i = 0; i < path.length - 1; i++) {
      pairPromises.push(
        getPairAddress(path[i], path[i + 1], sourceAddress)
      );
    }

    const pairAddresses = await Promise.all(pairPromises);

    // Validate all pairs exist
    for (let i = 0; i < pairAddresses.length; i++) {
      if (!pairAddresses[i]) {
        console.error('Pair not found for', path[i], '->', path[i + 1]);
        return [];
      }
    }

    // Step 2: Get all reserves in parallel using centralized function
    const reservesPromises = [];
    for (let i = 0; i < path.length - 1; i++) {
      reservesPromises.push(
        getReservesForSwap(pairAddresses[i]!, path[i], path[i + 1], sourceAddress)
      );
    }

    const reservesList = await Promise.all(reservesPromises);

    // Validate all reserves retrieved
    for (let i = 0; i < reservesList.length; i++) {
      if (!reservesList[i]) {
        console.error('Could not get reserves for hop', i);
        return [];
      }
    }

    // Step 3: Calculate amounts locally (no RPC calls)
    const amounts: string[] = [amountIn];
    let currentAmount = BigInt(amountIn);

    for (let i = 0; i < path.length - 1; i++) {
      const { reserveIn, reserveOut } = reservesList[i]!;

      console.log(`\n🔄 Swap hop ${i}: ${path[i].slice(0, 8)}... → ${path[i + 1].slice(0, 8)}...`);
      console.log(`💰 Reserves:`, {
        reserveIn: reserveIn.toString(),
        reserveOut: reserveOut.toString(),
        currentAmount: currentAmount.toString(),
      });

      // Calculate output amount (local computation)
      const amountOut = calculateAmountOut(currentAmount, reserveIn, reserveOut);
      console.log(`📈 Amount out:`, amountOut.toString());

      amounts.push(amountOut.toString());
      currentAmount = amountOut;
    }

    return amounts;
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

    const userScVal = StellarSdk.nativeToScVal(sourceAddress, { type: 'address' });
    const amountInScVal = StellarSdk.nativeToScVal(amountIn, { type: 'i128' });
    const amountOutMinScVal = StellarSdk.nativeToScVal(amountOutMin, { type: 'i128' });
    // Create vector of addresses properly - each address must be encoded individually
    const pathScVal = StellarSdk.xdr.ScVal.scvVec(
      path.map(addr => StellarSdk.nativeToScVal(addr, { type: 'address' }))
    );
    const deadlineScVal = StellarSdk.nativeToScVal(deadline, { type: 'u64' });

    const operation = contract.call(
      'swap_exact_tokens_for_tokens',
      userScVal,
      amountInScVal,
      amountOutMinScVal,
      pathScVal,
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
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // user
      StellarSdk.nativeToScVal(tokenA, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenB, { type: 'address' }),
      StellarSdk.nativeToScVal(amountADesired, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountBDesired, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountAMin, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountBMin, { type: 'i128' }),
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
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // user
      StellarSdk.nativeToScVal(tokenA, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenB, { type: 'address' }),
      StellarSdk.nativeToScVal(liquidity, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountAMin, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountBMin, { type: 'i128' }),
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
 * Staking Contract - Get pool count
 */
export async function getStakingPoolCount(sourceAddress: string): Promise<number> {
  try {
    const result = await callContract(
      CONTRACTS.STAKING,
      'pool_count',
      [],
      sourceAddress
    );
    return Number(result);
  } catch (error) {
    console.error('Error getting staking pool count:', error);
    return 0;
  }
}

/**
 * Staking Contract - Get pool info
 */
export async function getStakingPoolInfo(
  poolId: number,
  sourceAddress: string
): Promise<ContractStakingPool | null> {
  try {
    const poolIdScVal = StellarSdk.nativeToScVal(poolId, { type: 'u32' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'pool_info',
      [poolIdScVal],
      sourceAddress
    );

    return result;
  } catch (error) {
    console.error(`Error getting staking pool info for pool ${poolId}:`, error);
    return null;
  }
}

/**
 * Staking Contract - Get pending rewards for user
 */
export async function getPendingRewards(
  poolId: number,
  userAddress: string,
  sourceAddress: string
): Promise<string> {
  try {
    const userScVal = StellarSdk.nativeToScVal(userAddress, { type: 'address' });
    const poolIdScVal = StellarSdk.nativeToScVal(poolId, { type: 'u32' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'pending_rewards',
      [userScVal, poolIdScVal],
      sourceAddress
    );

    return String(result);
  } catch (error) {
    console.error('Error getting pending rewards:', error);
    return '0';
  }
}

/**
 * Staking Contract - Stake LP tokens
 * Contract signature: stake(user: Address, pool_id: u32, amount: i128)
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
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // user parameter
      StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' }),
      StellarSdk.nativeToScVal(amount, { type: 'i128' })
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
 * Contract signature: unstake(user: Address, pool_id: u32, amount: i128)
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
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // user parameter
      StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' }),
      StellarSdk.nativeToScVal(amount, { type: 'i128' })
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
 * Contract signature: claim_rewards(user: Address, pool_id: u32)
 */
export async function claimRewards(
  poolId: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'claim_rewards',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // user parameter
      StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' })
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
 * Contract signature: user_info(user: Address, pool_id: u32)
 */
export async function getUserStakeInfo(
  poolId: string,
  userAddress: string,
  sourceAddress: string
): Promise<{ staked: string; rewards: string } | null> {
  try {
    const userScVal = StellarSdk.nativeToScVal(userAddress, { type: 'address' });
    const poolIdScVal = StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'user_info',
      [userScVal, poolIdScVal], // Fixed: user first, then pool_id
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
 * Signature: fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32)
 * Reference: https://developers.stellar.org/docs/tokens/token-interface
 */
export async function approveToken(
  tokenAddress: string,
  spender: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    // Import sorobanServer
    const { sorobanServer } = await import('./stellar');

    const contract = new StellarSdk.Contract(tokenAddress);

    // Get current ledger from Soroban RPC
    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    // Calculate expiration ledger - use conservative value to avoid exceeding network limits
    // Testnet max TTL is ~535,679 ledgers (4 weeks)
    // We use 7 days to be safe: 7 * 17,280 = 120,960 ledgers
    // Stellar produces ~1 ledger every 5 seconds = 17,280 ledgers per day
    const daysToExpire = 7;  // Conservative: 1 week instead of 30 days
    const ledgersPerDay = 17280;
    const expirationLedger = currentLedger + (daysToExpire * ledgersPerDay);

    console.log('Token approval:', {
      token: tokenAddress,
      spender,
      amount,
      currentLedger,
      expirationLedger,
      daysToExpire,
    });

    const operation = contract.call(
      'approve',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // from
      StellarSdk.nativeToScVal(spender, { type: 'address' }),        // spender
      StellarSdk.nativeToScVal(amount, { type: 'i128' }),            // amount (i128 for SAC tokens)
      StellarSdk.nativeToScVal(expirationLedger, { type: 'u32' })   // expiration_ledger (u32, absolute)
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

  // Try path through intermediate tokens (USDC, XLM)
  // Note: This is a simplified 2-hop routing. For production with many pairs,
  // implement Dijkstra's algorithm or similar pathfinding
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

  // No path found
  return [tokenIn, tokenOut];
}
