/**
 * Centralized Token Addresses (Testnet)
 * Single source of truth for all token contract IDs
 *
 * IMPORTANT: These addresses are for Stellar TESTNET only
 * For mainnet deployment, these need to be updated
 */

/**
 * Native XLM (SAC - Stellar Asset Contract)
 * Wrapped XLM for use in Soroban smart contracts
 */
export const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

/**
 * Circle USDC on Stellar Testnet
 * Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 */
export const USDC_TESTNET_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

/**
 * Default token pair for SwapCard and other components
 * Using named constants instead of array indices for robustness
 *
 * This eliminates fragile code like BASE_TOKENS[0], BASE_TOKENS[1]
 */
export const DEFAULT_SWAP_PAIR = {
  tokenIn: NATIVE_XLM_SAC,
  tokenOut: USDC_TESTNET_SAC,
} as const;

/**
 * Favorite tokens (for initial UI state)
 * Users can toggle favorites, but these are the defaults
 */
export const DEFAULT_FAVORITES = [NATIVE_XLM_SAC, USDC_TESTNET_SAC] as const;
