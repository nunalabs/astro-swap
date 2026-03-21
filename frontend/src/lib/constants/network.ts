/**
 * Network configuration
 * Environment-specific URLs for Stellar services
 *
 * Set VITE_STELLAR_NETWORK in .env to switch between networks:
 * - testnet (default)
 * - mainnet (production)
 */

const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';

/**
 * Stellar blockchain explorer URL
 * Used for transaction links, account lookups, etc
 */
export const STELLAR_EXPLORER_URL = NETWORK === 'mainnet'
  ? 'https://stellarchain.io/transactions'
  : 'https://testnet.stellarchain.io/transactions';

/**
 * Stellar Horizon API URL
 * Main API for querying blockchain data
 */
export const STELLAR_HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';

/**
 * Helper to get explorer link for a transaction
 *
 * @param txHash Transaction hash (hex string)
 * @returns Full URL to view transaction in explorer
 *
 * @example
 * const link = getExplorerLink('abc123...');
 * // Returns: 'https://testnet.stellarchain.io/transactions/abc123...'
 */
export function getExplorerLink(txHash: string): string {
  return `${STELLAR_EXPLORER_URL}/${txHash}`;
}

/**
 * Helper to get explorer link for an account
 *
 * @param accountId Stellar account public key (G...)
 * @returns Full URL to view account in explorer
 */
export function getAccountExplorerLink(accountId: string): string {
  const baseUrl = NETWORK === 'mainnet'
    ? 'https://stellarchain.io/accounts'
    : 'https://testnet.stellarchain.io/accounts';
  return `${baseUrl}/${accountId}`;
}
