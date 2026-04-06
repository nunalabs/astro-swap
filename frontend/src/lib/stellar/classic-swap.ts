/**
 * Classic Stellar Path Payment
 *
 * Builds and submits a path_payment_strict_send transaction
 * through the Stellar classic network (SDEX + P18 AMM).
 * Uses Horizon API directly - no Soroban RPC needed.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORK_CONFIG, horizonServer } from './config';
import { confirmTransaction } from './confirmation';
import { signTransaction } from '../wallet-kit';
import type { StellarAsset } from '../../hooks/useHorizonPathQuote';

/**
 * Convert our StellarAsset type to StellarSdk.Asset
 */
function toSdkAsset(asset: StellarAsset): StellarSdk.Asset {
  if (!asset.issuer) {
    return StellarSdk.Asset.native();
  }
  return new StellarSdk.Asset(asset.code, asset.issuer);
}

/**
 * Execute a classic path payment (strict send).
 * Routes through SDEX orderbook and P18 AMM pools automatically.
 *
 * @param sourceAddress - Sender's Stellar address
 * @param sourceAsset - Input asset
 * @param destAsset - Output asset
 * @param sendAmount - Amount to send (raw stroops as string)
 * @param destMinAmount - Minimum output (after slippage, raw stroops)
 * @param intermediaryPath - Optional intermediary assets from Horizon /paths
 * @param decimals - Token decimals for amount conversion (default 7)
 * @returns Transaction hash
 */
export async function executeClassicPathPayment(
  sourceAddress: string,
  sourceAsset: StellarAsset,
  destAsset: StellarAsset,
  sendAmount: string,
  destMinAmount: string,
  intermediaryPath: StellarAsset[] = [],
  decimals = 7
): Promise<string> {
  // Load account
  const account = await horizonServer.loadAccount(sourceAddress);

  // Convert raw amounts to decimal strings for Operation
  const divisor = Math.pow(10, decimals);
  const sendAmountDecimal = (Number(sendAmount) / divisor).toFixed(decimals);
  const destMinDecimal = (Number(destMinAmount) / divisor).toFixed(decimals);

  // Build path payment operation
  const operation = StellarSdk.Operation.pathPaymentStrictSend({
    sendAsset: toSdkAsset(sourceAsset),
    sendAmount: sendAmountDecimal,
    destination: sourceAddress, // send to self
    destAsset: toSdkAsset(destAsset),
    destMin: destMinDecimal,
    path: intermediaryPath.map(toSdkAsset),
  });

  // Build transaction
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: NETWORK_CONFIG.baseFee,
    networkPassphrase: NETWORK_CONFIG.passphrase,
  })
    .addOperation(operation)
    .setTimeout(NETWORK_CONFIG.timeout)
    .build();

  // Sign with wallet (uses StellarWalletsKit from wallet-kit.ts)
  const signedXdr = await signTransaction(transaction.toXDR());

  // Submit to Horizon
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_CONFIG.passphrase
  ) as StellarSdk.Transaction;

  const response = await horizonServer.submitTransaction(signedTx);
  const hash = response.hash;

  // Confirm
  await confirmTransaction(hash);

  return hash;
}
