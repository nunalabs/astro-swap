import * as StellarSdk from '@stellar/stellar-sdk';
import { sorobanServer, NETWORK_PASSPHRASE } from './stellar';
import { getAllPairs } from './contracts';
import type { Token } from '../types';

/**
 * Token Indexer Service
 * Automatically discovers and indexes tokens from the DEX factory and pairs
 *
 * PERFORMANCE: Uses batched parallel requests to minimize RPC calls (N+1 fix)
 */

// Cache for token metadata to avoid repeated calls
const tokenMetadataCache = new Map<string, Token>();

// Pending requests map to deduplicate concurrent requests for same token
const pendingRequests = new Map<string, Promise<Token | null>>();

// Batch size for concurrent metadata fetches (prevents overwhelming RPC)
const BATCH_SIZE = 5;

/**
 * Fetch token metadata from a Soroban token contract
 * PERFORMANCE: Fetches symbol, name, and decimals in parallel (3x faster)
 */
export async function fetchTokenMetadata(tokenAddress: string): Promise<Token | null> {
  // Check cache first
  if (tokenMetadataCache.has(tokenAddress)) {
    return tokenMetadataCache.get(tokenAddress)!;
  }

  // Check if there's already a pending request for this token (deduplication)
  if (pendingRequests.has(tokenAddress)) {
    return pendingRequests.get(tokenAddress)!;
  }

  // Create the fetch promise
  const fetchPromise = fetchTokenMetadataInternal(tokenAddress);
  pendingRequests.set(tokenAddress, fetchPromise);

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    // Clean up pending request
    pendingRequests.delete(tokenAddress);
  }
}

/**
 * Internal function to fetch token metadata with parallel RPC calls
 */
async function fetchTokenMetadataInternal(tokenAddress: string): Promise<Token | null> {
  try {
    // Create a dummy account for simulation
    const dummyAccount = new StellarSdk.Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );

    const contract = new StellarSdk.Contract(tokenAddress);

    // PERFORMANCE: Build all transactions upfront
    const symbolTx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('symbol'))
      .setTimeout(30)
      .build();

    const nameTx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('name'))
      .setTimeout(30)
      .build();

    const decimalsTx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('decimals'))
      .setTimeout(30)
      .build();

    // PERFORMANCE: Execute all 3 simulations in parallel (N+1 fix)
    const [symbolResult, nameResult, decimalsResult] = await Promise.all([
      sorobanServer.simulateTransaction(symbolTx),
      sorobanServer.simulateTransaction(nameTx),
      sorobanServer.simulateTransaction(decimalsTx),
    ]);

    // Validate all results
    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(symbolResult)) {
      console.error(`Failed to fetch symbol for ${tokenAddress}`);
      return null;
    }

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(nameResult)) {
      console.error(`Failed to fetch name for ${tokenAddress}`);
      return null;
    }

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(decimalsResult)) {
      console.error(`Failed to fetch decimals for ${tokenAddress}`);
      return null;
    }

    const symbol = StellarSdk.scValToNative(symbolResult.result!.retval) as string;
    const name = StellarSdk.scValToNative(nameResult.result!.retval) as string;
    const decimals = Number(StellarSdk.scValToNative(decimalsResult.result!.retval));

    const token: Token = {
      address: tokenAddress,
      symbol,
      name,
      decimals,
      logoURI: getTokenLogoURI(symbol),
    };

    // Cache the result
    tokenMetadataCache.set(tokenAddress, token);

    return token;
  } catch (error) {
    console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Batch fetch metadata for multiple tokens
 * PERFORMANCE: Processes tokens in batches to avoid overwhelming RPC
 */
export async function fetchTokenMetadataBatch(tokenAddresses: string[]): Promise<Map<string, Token>> {
  const results = new Map<string, Token>();

  // Filter out already cached tokens
  const uncachedAddresses = tokenAddresses.filter(addr => {
    const cached = tokenMetadataCache.get(addr);
    if (cached) {
      results.set(addr, cached);
      return false;
    }
    return true;
  });

  // Process uncached tokens in batches
  for (let i = 0; i < uncachedAddresses.length; i += BATCH_SIZE) {
    const batch = uncachedAddresses.slice(i, i + BATCH_SIZE);

    // Fetch batch in parallel
    const batchResults = await Promise.all(
      batch.map(addr => fetchTokenMetadata(addr))
    );

    // Add successful results to map
    batchResults.forEach((token, idx) => {
      if (token) {
        results.set(batch[idx], token);
      }
    });
  }

  return results;
}

/**
 * Get token info from a pair contract
 * PERFORMANCE: Fetches token0 and token1 in parallel (2x faster)
 */
export async function getPairTokens(
  pairAddress: string
): Promise<{ token0: string; token1: string } | null> {
  try {
    const dummyAccount = new StellarSdk.Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );

    const contract = new StellarSdk.Contract(pairAddress);

    // PERFORMANCE: Build both transactions upfront
    const token0Tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('token_0'))
      .setTimeout(30)
      .build();

    const token1Tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('token_1'))
      .setTimeout(30)
      .build();

    // PERFORMANCE: Execute both simulations in parallel
    const [token0Result, token1Result] = await Promise.all([
      sorobanServer.simulateTransaction(token0Tx),
      sorobanServer.simulateTransaction(token1Tx),
    ]);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(token0Result)) {
      console.error(`Failed to fetch token0 for pair ${pairAddress}`);
      return null;
    }

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(token1Result)) {
      console.error(`Failed to fetch token1 for pair ${pairAddress}`);
      return null;
    }

    const token0 = StellarSdk.scValToNative(token0Result.result!.retval) as string;
    const token1 = StellarSdk.scValToNative(token1Result.result!.retval) as string;

    return { token0, token1 };
  } catch (error) {
    console.error(`Error fetching pair tokens for ${pairAddress}:`, error);
    return null;
  }
}

/**
 * Index all tokens from factory pairs
 * PERFORMANCE: Uses batch fetching to minimize RPC calls
 */
export async function indexTokensFromFactory(sourceAddress: string): Promise<Token[]> {
  try {
    // Get all pairs from factory
    const pairs = await getAllPairs(sourceAddress);

    if (!pairs || pairs.length === 0) {
      console.log('No pairs found in factory');
      return [];
    }

    const tokenAddresses = new Set<string>();

    // PERFORMANCE: Fetch pair tokens in batches of BATCH_SIZE
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      const batch = pairs.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(pairAddress => getPairTokens(pairAddress))
      );

      for (const pairTokens of batchResults) {
        if (pairTokens) {
          tokenAddresses.add(pairTokens.token0);
          tokenAddresses.add(pairTokens.token1);
        }
      }
    }

    // PERFORMANCE: Batch fetch metadata for all unique tokens
    const tokenAddressArray = Array.from(tokenAddresses);
    const metadataMap = await fetchTokenMetadataBatch(tokenAddressArray);

    return Array.from(metadataMap.values());
  } catch (error) {
    console.error('Error indexing tokens from factory:', error);
    return [];
  }
}

/**
 * Get well-known token logo URIs
 */
function getTokenLogoURI(symbol: string): string | undefined {
  const knownLogos: Record<string, string> = {
    'XLM': 'https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png',
    'USDC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  };

  return knownLogos[symbol.toUpperCase()];
}

/**
 * Clear the token metadata cache
 */
export function clearTokenCache(): void {
  tokenMetadataCache.clear();
}
