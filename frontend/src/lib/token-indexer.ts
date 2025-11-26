import * as StellarSdk from '@stellar/stellar-sdk';
import { sorobanServer, NETWORK_PASSPHRASE } from './stellar';
import { getAllPairs } from './contracts';
import type { Token } from '../types';

/**
 * Token Indexer Service
 * Automatically discovers and indexes tokens from the DEX factory and pairs
 */

// Cache for token metadata to avoid repeated calls
const tokenMetadataCache = new Map<string, Token>();

/**
 * Fetch token metadata from a Soroban token contract
 */
export async function fetchTokenMetadata(tokenAddress: string): Promise<Token | null> {
  // Check cache first
  if (tokenMetadataCache.has(tokenAddress)) {
    return tokenMetadataCache.get(tokenAddress)!;
  }

  try {
    // Create a dummy account for simulation
    const dummyAccount = new StellarSdk.Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );

    const contract = new StellarSdk.Contract(tokenAddress);

    // Fetch symbol
    const symbolTx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('symbol'))
      .setTimeout(30)
      .build();

    const symbolResult = await sorobanServer.simulateTransaction(symbolTx);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(symbolResult)) {
      console.error(`Failed to fetch symbol for ${tokenAddress}`);
      return null;
    }

    const symbol = StellarSdk.scValToNative(symbolResult.result!.retval) as string;

    // Fetch name
    const nameTx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('name'))
      .setTimeout(30)
      .build();

    const nameResult = await sorobanServer.simulateTransaction(nameTx);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(nameResult)) {
      console.error(`Failed to fetch name for ${tokenAddress}`);
      return null;
    }

    const name = StellarSdk.scValToNative(nameResult.result!.retval) as string;

    // Fetch decimals
    const decimalsTx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('decimals'))
      .setTimeout(30)
      .build();

    const decimalsResult = await sorobanServer.simulateTransaction(decimalsTx);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(decimalsResult)) {
      console.error(`Failed to fetch decimals for ${tokenAddress}`);
      return null;
    }

    const decimals = Number(StellarSdk.scValToNative(decimalsResult.result!.retval));

    const token: Token = {
      address: tokenAddress,
      symbol,
      name,
      decimals,
      logoURI: getTokenLogoURI(symbol), // Try to get known logo
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
 * Get token info from a pair contract
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

    // Fetch token0
    const token0Tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('token_0'))
      .setTimeout(30)
      .build();

    const token0Result = await sorobanServer.simulateTransaction(token0Tx);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(token0Result)) {
      console.error(`Failed to fetch token0 for pair ${pairAddress}`);
      return null;
    }

    const token0 = StellarSdk.scValToNative(token0Result.result!.retval) as string;

    // Fetch token1
    const token1Tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('token_1'))
      .setTimeout(30)
      .build();

    const token1Result = await sorobanServer.simulateTransaction(token1Tx);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(token1Result)) {
      console.error(`Failed to fetch token1 for pair ${pairAddress}`);
      return null;
    }

    const token1 = StellarSdk.scValToNative(token1Result.result!.retval) as string;

    return { token0, token1 };
  } catch (error) {
    console.error(`Error fetching pair tokens for ${pairAddress}:`, error);
    return null;
  }
}

/**
 * Index all tokens from factory pairs
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

    // Extract token addresses from each pair
    for (const pairAddress of pairs) {
      const pairTokens = await getPairTokens(pairAddress);
      if (pairTokens) {
        tokenAddresses.add(pairTokens.token0);
        tokenAddresses.add(pairTokens.token1);
      }
    }

    // Fetch metadata for each unique token
    const tokens: Token[] = [];

    for (const address of tokenAddresses) {
      const metadata = await fetchTokenMetadata(address);
      if (metadata) {
        tokens.push(metadata);
      }
    }

    return tokens;
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
