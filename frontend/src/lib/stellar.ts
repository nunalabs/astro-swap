/**
 * Stellar SDK Integration (Backwards Compatible Wrapper)
 *
 * This file maintains backwards compatibility while using the new modular architecture.
 * All new code should import directly from '@/lib/stellar/*' modules.
 *
 * @deprecated Import from '@/lib/stellar/transaction', '@/lib/stellar/accounts', etc. instead
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction as signWithWalletKit } from './wallet-kit';

// Import from new modular structure
import {
  horizonServer,
  sorobanServer,
  NETWORK_CONFIG,
} from './stellar/config';

import { getAccountBalance, getTokenBalance } from './stellar/accounts';
import { buildAndSubmitTransaction as buildAndSubmitTx, callContract as callContractNew, type WalletSigner } from './stellar/transaction';
import { parseError, extractSimulationError } from './stellar/errors';

// Re-export for backwards compatibility
export const server = horizonServer;
export { sorobanServer };

export const NETWORK_PASSPHRASE = NETWORK_CONFIG.passphrase;
export const HORIZON_URL = NETWORK_CONFIG.horizonUrl;
export const SOROBAN_RPC_URL = NETWORK_CONFIG.sorobanRpcUrl;

/**
 * Sign transaction with connected wallet (via Stellar Wallets Kit)
 */
export async function signTransactionWithWallet(xdr: string): Promise<string> {
  return signWithWalletKit(xdr);
}

/**
 * Get account balance (wrapped for backwards compatibility)
 */
export { getAccountBalance };

/**
 * Get token balance (wrapped for backwards compatibility)
 */
export { getTokenBalance };

/**
 * Result from transaction simulation
 */
export interface SimulationResult {
  success: boolean;
  error?: string;
  estimatedFee?: string;
  minResourceFee?: string;
  events?: unknown[];
}

/**
 * Simulate a transaction to estimate fees
 */
export async function simulateTransaction(
  sourceAddress: string,
  operations: StellarSdk.xdr.Operation[]
): Promise<SimulationResult> {
  try {
    const sourceAccount = await horizonServer.loadAccount(sourceAddress);

    let builder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    operations.forEach(op => {
      builder = builder.addOperation(op);
    });

    const transaction = builder.setTimeout(30).build();
    const simulated = await sorobanServer.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationSuccess(simulated)) {
      return {
        success: true,
        estimatedFee: simulated.minResourceFee,
        minResourceFee: simulated.minResourceFee,
      };
    }

    const errorMessage = extractSimulationError(simulated);
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    const parsed = parseError(error);
    return {
      success: false,
      error: parsed.message,
    };
  }
}

/**
 * Build and submit a Soroban transaction
 *
 * @deprecated Use buildAndSubmitTransaction from '@/lib/stellar/transaction' instead
 */
export async function buildAndSubmitTransaction(
  sourceAddress: string,
  operations: StellarSdk.xdr.Operation[]
): Promise<string> {
  // Create wallet signer adapter
  const signer: WalletSigner = {
    signTransaction: signTransactionWithWallet,
  };

  // Use new modular transaction system
  const result = await buildAndSubmitTx({
    sourceAddress,
    operations,
    signer,
  });

  // For backwards compatibility, throw if transaction failed
  if (result.confirmation.status === 'FAILED') {
    throw new Error(result.confirmation.error || 'Transaction failed');
  }

  return result.hash;
}

/**
 * Call a contract method (read-only)
 */
export async function callContract(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourceAddress: string
): Promise<any> {
  return callContractNew(contractId, method, args, sourceAddress);
}

// Re-export parseError for backwards compatibility
export { parseError };
