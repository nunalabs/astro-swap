/**
 * Stellar Network Configuration
 *
 * Centralized network configuration for all Stellar/Soroban interactions.
 * Single source of truth for network settings.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

// Network selection
const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';

export const NETWORK_CONFIG = {
  network: NETWORK as 'testnet' | 'mainnet',

  // Network passphrase
  passphrase: NETWORK === 'mainnet'
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET,

  // Horizon API (for reliable transaction status)
  horizonUrl: NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org',

  // Soroban RPC (for contract calls and simulation)
  sorobanRpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL ||
    (NETWORK === 'mainnet'
      ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
      : 'https://soroban-testnet.stellar.org'),

  // Transaction settings
  baseFee: StellarSdk.BASE_FEE,

  // Timeout: longer for testnet (slower), shorter for mainnet
  timeout: parseInt(import.meta.env.VITE_TRANSACTION_TIMEOUT || (NETWORK === 'testnet' ? '120' : '60')),

  // Confirmation settings
  confirmationStrategy: (import.meta.env.VITE_CONFIRMATION_STRATEGY || 'horizon') as 'horizon' | 'rpc' | 'skip',
  confirmationTimeout: parseInt(import.meta.env.VITE_CONFIRMATION_TIMEOUT || '60'),
  confirmationPollInterval: parseInt(import.meta.env.VITE_CONFIRMATION_POLL_INTERVAL || '1000'),

  // Async submission (for /transactions_async)
  useAsyncSubmission: import.meta.env.VITE_USE_ASYNC_SUBMISSION === 'true',
};

// Initialize Stellar servers
export const horizonServer = new StellarSdk.Horizon.Server(NETWORK_CONFIG.horizonUrl);
export const sorobanServer = new StellarSdk.rpc.Server(NETWORK_CONFIG.sorobanRpcUrl);

/**
 * Check if running on testnet
 */
export function isTestnet(): boolean {
  return NETWORK_CONFIG.network === 'testnet';
}

/**
 * Check if running on mainnet
 */
export function isMainnet(): boolean {
  return NETWORK_CONFIG.network === 'mainnet';
}

/**
 * Get Stellar Expert URL for transaction
 */
export function getStellarExpertTxUrl(hash: string): string {
  const network = isTestnet() ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}
