/**
 * Contracts Module - Public API
 * Re-exports all contract functions for easy importing
 */

// Config
export { CONTRACTS, validateContracts } from './config';

// Types
export type {
  ContractStakingPool,
  ContractUserStake,
  ReservesResult,
  ReservesForPairResult,
  ReservesForSwapResult,
} from './types';

// Factory functions
export { getAllPairs, getPairAddress } from './factory';

// Pair functions
export {
  getReserves,
  getTotalSupply,
  getReservesForPair,
  getReservesForSwap,
} from './pair';

// Router functions
export {
  getAmountsOut,
  swapExactTokensForTokens,
  addLiquidity,
  removeLiquidity,
} from './router';

// Staking functions
export {
  getStakingPoolCount,
  getStakingPoolInfo,
  getPendingRewards,
  stake,
  unstake,
  claimRewards,
  getUserStakeInfo,
} from './staking';

// Token functions
export { approveToken } from './tokens';

// Path functions
export { calculateOptimalPath } from './path';
