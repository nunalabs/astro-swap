/**
 * Account Operations
 *
 * Functions for querying account and token balances.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { horizonServer, sorobanServer, NETWORK_CONFIG } from './config';
import { rpcLimiter } from '../rate-limiter';

/**
 * Get native XLM balance for an account
 */
export async function getAccountBalance(address: string): Promise<string> {
  try {
    const account = await horizonServer.loadAccount(address);
    const nativeBalance = account.balances.find(
      (balance) => balance.asset_type === 'native'
    );

    return nativeBalance ? nativeBalance.balance : '0';
  } catch {
    return '0';
  }
}

/**
 * Get token balance for an account
 */
export async function getTokenBalance(
  address: string,
  tokenAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(tokenAddress);
    const addressScVal = StellarSdk.nativeToScVal(address, { type: 'address' });

    const result = await rpcLimiter.execute(() => sorobanServer.simulateTransaction(
      new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(address, '0'),
        {
          fee: '100',
          networkPassphrase: NETWORK_CONFIG.passphrase,
        }
      )
        .addOperation(contract.call('balance', addressScVal))
        .setTimeout(30)
        .build()
    ));

    if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
      const balance = StellarSdk.scValToNative(result.result!.retval);
      return balance.toString();
    }

    return '0';
  } catch {
    return '0';
  }
}
