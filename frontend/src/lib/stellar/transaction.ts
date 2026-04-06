/**
 * Transaction Manager
 *
 * Handles transaction building, simulation, signing, and submission.
 * Modular design for easy testing and maintenance.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORK_CONFIG, horizonServer, sorobanServer } from './config';
import { parseError, extractSimulationError, StellarTransactionError } from './errors';
import { confirmTransaction, type ConfirmationResult } from './confirmation';
import { rpcLimiter } from '../rate-limiter';
import { withRetry } from './retry';
import { contractCallCache } from './cache';
import { rpcCircuitBreaker, horizonCircuitBreaker } from './circuit-breaker';
import { metrics, measureTiming } from './metrics';

/**
 * Wallet signer interface (injected dependency)
 */
export interface WalletSigner {
  signTransaction(xdr: string): Promise<string>;
}

/**
 * Transaction builder options
 */
export interface TransactionOptions {
  sourceAddress: string;
  operations: StellarSdk.xdr.Operation[];
  signer: WalletSigner;
  skipConfirmation?: boolean;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  hash: string;
  confirmation: ConfirmationResult;
}

/**
 * Build, simulate, sign, and submit a Soroban transaction
 */
export async function buildAndSubmitTransaction(
  options: TransactionOptions
): Promise<TransactionResult> {
  const { sourceAddress, operations, signer, skipConfirmation = false } = options;

  try {
    metrics.increment('transaction.submitted');

    // Step 1: Load source account (with circuit breaker and retry)
    const sourceAccount = await withRetry(
      () => horizonCircuitBreaker.execute(() =>
        horizonServer.loadAccount(sourceAddress)
      ),
      { maxAttempts: 3 }
    );

    // Step 2: Build transaction
    let builder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: NETWORK_CONFIG.baseFee,
      networkPassphrase: NETWORK_CONFIG.passphrase,
    });

    operations.forEach(op => {
      builder = builder.addOperation(op);
    });

    const transaction = builder.setTimeout(NETWORK_CONFIG.timeout).build();

    // Step 3: Simulate transaction (with circuit breaker and retry)
    const simulated = await measureTiming(
      'transaction.simulate',
      () => withRetry(
        () => rpcCircuitBreaker.execute(() =>
          rpcLimiter.execute(() => sorobanServer.simulateTransaction(transaction))
        ),
        { maxAttempts: 3 }
      )
    );

    if (!StellarSdk.rpc.Api.isSimulationSuccess(simulated)) {
      console.error('❌ Simulation failed:', JSON.stringify(simulated, null, 2));

      const errorMessage = extractSimulationError(simulated);
      throw new StellarTransactionError(errorMessage, 'SIMULATION_FAILED', simulated);
    }

    // Step 4: Prepare transaction with proper fee
    const preparedTx = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulated
    ).build();

    // Step 5: Sign transaction
    const signedXdr = await signer.signTransaction(preparedTx.toXDR());

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      NETWORK_CONFIG.passphrase
    );

    // Step 6: Submit transaction (with circuit breaker and retry)
    const result = await measureTiming(
      'transaction.submit',
      () => withRetry(
        () => rpcCircuitBreaker.execute(() =>
          rpcLimiter.execute(() => sorobanServer.sendTransaction(signedTx as StellarSdk.Transaction))
        ),
        { maxAttempts: 3 }
      )
    );

    // Check for immediate rejection
    if (result.status === 'ERROR') {
      console.error('❌ Transaction rejected by RPC');
      console.error('📋 Details:', JSON.stringify(result, null, 2));
      throw new StellarTransactionError(
        'Transaction rejected by network',
        'TX_REJECTED',
        result
      );
    }

    // Step 7: Confirm transaction (or skip if requested)
    let confirmation: ConfirmationResult;

    if (skipConfirmation) {
      confirmation = {
        status: 'PENDING',
        hash: result.hash,
      };
    } else {
      confirmation = await measureTiming(
        'transaction.confirm',
        () => confirmTransaction(result.hash),
        { strategy: NETWORK_CONFIG.confirmationStrategy }
      );
    }

    // Record metrics
    if (confirmation.status === 'SUCCESS') {
      metrics.increment('transaction.success');
    } else if (confirmation.status === 'FAILED') {
      metrics.increment('transaction.failed');
    }

    // Return result
    return {
      hash: result.hash,
      confirmation,
    };

  } catch (error) {
    console.error('❌ Transaction failed:', error);
    metrics.increment('transaction.failed', { error: 'true' });
    throw error;
  }
}

/**
 * Call a contract method (read-only, no transaction)
 * Uses caching, circuit breaker, and retry logic
 */
export async function callContract(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourceAddress: string,
  options: { skipCache?: boolean; cacheTtlMs?: number } = {}
): Promise<any> {
  // Check cache first (unless skipped)
  if (!options.skipCache) {
    const cached = contractCallCache.get(contractId, method, args);
    if (cached !== undefined) {
      metrics.increment('cache.hit', { contract: contractId, method });
      return cached;
    }
    metrics.increment('cache.miss', { contract: contractId, method });
  }

  try {
    const contract = new StellarSdk.Contract(contractId);

    const result = await measureTiming(
      'rpc.call',
      () => withRetry(
        () => rpcCircuitBreaker.execute(() =>
          rpcLimiter.execute(() => sorobanServer.simulateTransaction(
            new StellarSdk.TransactionBuilder(
              new StellarSdk.Account(sourceAddress, '0'),
              {
                fee: '100',
                networkPassphrase: NETWORK_CONFIG.passphrase,
              }
            )
              .addOperation(contract.call(method, ...args))
              .setTimeout(30)
              .build()
          ))
        ),
        { maxAttempts: 3 }
      ),
      { contract: contractId, method }
    );

    if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
      const value = StellarSdk.scValToNative(result.result!.retval);

      // Cache result
      if (!options.skipCache) {
        contractCallCache.set(contractId, method, args, value, options.cacheTtlMs);
      }

      return value;
    }

    const errorMessage = extractSimulationError(result);
    metrics.increment('rpc.error', { contract: contractId, method });
    throw new Error(`Contract call failed: ${errorMessage}`);

  } catch (error) {
    metrics.increment('rpc.error', { contract: contractId, method });
    const parsed = parseError(error);
    throw new Error(`Contract call error: ${parsed.message}`);
  }
}
