import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction as signWithWalletKit } from './wallet-kit';

// Network configuration
const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';

export const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

export const HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';

export const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL ||
  (NETWORK === 'mainnet'
    ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
    : 'https://soroban-testnet.stellar.org');

// Initialize Stellar Server
export const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// Initialize Soroban RPC Server
export const sorobanServer = new StellarSdk.SorobanRpc.Server(SOROBAN_RPC_URL);

/**
 * Sign transaction with connected wallet (via Stellar Wallets Kit)
 */
export async function signTransactionWithWallet(xdr: string): Promise<string> {
  return signWithWalletKit(xdr);
}

/**
 * Get account balance
 */
export async function getAccountBalance(address: string): Promise<string> {
  try {
    const account = await server.loadAccount(address);
    const nativeBalance = account.balances.find(
      (balance) => balance.asset_type === 'native'
    );

    return nativeBalance ? nativeBalance.balance : '0';
  } catch (error) {
    console.error('Error fetching account balance:', error);
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

    const result = await sorobanServer.simulateTransaction(
      new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(address, '0'),
        {
          fee: '100',
          networkPassphrase: NETWORK_PASSPHRASE,
        }
      )
        .addOperation(
          contract.call('balance', addressScVal)
        )
        .setTimeout(30)
        .build()
    );

    if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
      const balance = StellarSdk.scValToNative(result.result!.retval);
      return balance.toString();
    }

    return '0';
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
}

/**
 * Build and submit a Soroban transaction
 */
export async function buildAndSubmitTransaction(
  sourceAddress: string,
  operations: StellarSdk.xdr.Operation[]
): Promise<string> {
  try {
    // Load source account
    const sourceAccount = await server.loadAccount(sourceAddress);

    // Build transaction with operations
    let builder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    // Add each operation to the builder
    operations.forEach(op => {
      builder = builder.addOperation(op);
    });

    const transaction = builder.setTimeout(30).build();

    // Simulate transaction to get the fee
    const simulated = await sorobanServer.simulateTransaction(transaction);

    if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(simulated)) {
      throw new Error('Transaction simulation failed');
    }

    // Prepare transaction with proper fee
    const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(
      transaction,
      simulated
    ).build();

    // Sign with connected wallet
    const signedXdr = await signTransactionWithWallet(preparedTx.toXDR());
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      NETWORK_PASSPHRASE
    );

    // Submit transaction
    const result = await sorobanServer.sendTransaction(signedTx as StellarSdk.Transaction);

    // Wait for transaction to be included in a ledger
    let status = await sorobanServer.getTransaction(result.hash);

    while (status.status === 'NOT_FOUND') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = await sorobanServer.getTransaction(result.hash);
    }

    if (status.status === 'SUCCESS') {
      return result.hash;
    }

    throw new Error('Transaction failed');
  } catch (error) {
    console.error('Error building and submitting transaction:', error);
    throw error;
  }
}

/**
 * Call a contract method (read-only)
 */
export async function callContract(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourceAddress: string
): Promise<unknown> {
  try {
    const contract = new StellarSdk.Contract(contractId);
    const sourceAccount = await server.loadAccount(sourceAddress);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await sorobanServer.simulateTransaction(transaction);

    if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
      return StellarSdk.scValToNative(result.result!.retval);
    }

    throw new Error('Contract call simulation failed');
  } catch (error) {
    console.error('Error calling contract:', error);
    throw error;
  }
}

// Freighter wallet types are defined in vite-env.d.ts
