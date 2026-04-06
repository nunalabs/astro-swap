/**
 * Transaction Confirmation Strategies
 *
 * Multiple strategies for confirming transactions on Stellar network.
 * Handles RPC instability by providing fallbacks.
 */

import { NETWORK_CONFIG, horizonServer, sorobanServer } from './config';
import { StellarTransactionError, isHttpError } from './errors';
import { rpcLimiter } from '../rate-limiter';

export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'PENDING';

export interface ConfirmationResult {
  status: TransactionStatus;
  hash: string;
  ledger?: number;
  error?: string;
}

/**
 * Confirm transaction using Horizon API (most reliable)
 */
export async function confirmViaHorizon(
  txHash: string,
  timeoutSeconds: number = NETWORK_CONFIG.confirmationTimeout
): Promise<ConfirmationResult> {
  const startTime = Date.now();
  const maxTime = startTime + (timeoutSeconds * 1000);

  while (Date.now() < maxTime) {
    try {
      // Try to load transaction from Horizon
      const tx = await horizonServer.transactions()
        .transaction(txHash)
        .call();

      const ledgerNum = typeof tx.ledger === 'function' ? undefined : Number(tx.ledger);

      return {
        status: tx.successful ? 'SUCCESS' : 'FAILED',
        hash: txHash,
        ledger: ledgerNum,
      };
    } catch (error: unknown) {
      // 404 means transaction not found yet (still pending)
      if (isHttpError(error) && error.response?.status === 404) {
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, NETWORK_CONFIG.confirmationPollInterval));
        continue;
      }

      // Other errors are real failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new StellarTransactionError(
        `Failed to confirm transaction: ${errorMessage}`,
        'CONFIRMATION_ERROR',
        error
      );
    }
  }

  // Timeout reached
  return {
    status: 'NOT_FOUND',
    hash: txHash,
    error: 'Confirmation timeout. Transaction may still be processing.',
  };
}

/**
 * Confirm transaction using Soroban RPC (less reliable due to XDR parsing issues)
 */
export async function confirmViaRPC(
  txHash: string,
  timeoutSeconds: number = NETWORK_CONFIG.confirmationTimeout
): Promise<ConfirmationResult> {
  const maxTime = Date.now() + (timeoutSeconds * 1000);

  while (Date.now() < maxTime) {
    try {
      const status = await rpcLimiter.execute(() =>
        sorobanServer.getTransaction(txHash)
      );

      if (status.status === 'SUCCESS') {
        return { status: 'SUCCESS', hash: txHash };
      }

      if (status.status === 'FAILED') {
        return {
          status: 'FAILED',
          hash: txHash,
          error: 'Transaction failed on network',
        };
      }

      // NOT_FOUND - keep polling
      await new Promise(resolve => setTimeout(resolve, NETWORK_CONFIG.confirmationPollInterval));

    } catch (error: unknown) {
      // XDR parsing errors - known RPC issue, keep trying
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('union switch') || errorMessage.includes('XDR')) {
        await new Promise(resolve => setTimeout(resolve, NETWORK_CONFIG.confirmationPollInterval));
        continue;
      }

      // Other errors are real failures
      throw error;
    }
  }

  // Timeout reached
  return {
    status: 'NOT_FOUND',
    hash: txHash,
    error: 'Confirmation timeout. Transaction may still be processing.',
  };
}

/**
 * Skip confirmation and return immediately (for unstable networks)
 */
export async function skipConfirmation(txHash: string): Promise<ConfirmationResult> {
  return {
    status: 'PENDING',
    hash: txHash,
    error: 'Confirmation skipped. Check Stellar Expert for status.',
  };
}

/**
 * Confirm transaction using configured strategy
 */
export async function confirmTransaction(txHash: string): Promise<ConfirmationResult> {
  const strategy = NETWORK_CONFIG.confirmationStrategy;

  switch (strategy) {
    case 'horizon':
      return confirmViaHorizon(txHash);

    case 'rpc':
      return confirmViaRPC(txHash);

    case 'skip':
      return skipConfirmation(txHash);

    default:
      throw new Error(`Unknown confirmation strategy: ${strategy}`);
  }
}
