/**
 * Base Contract Client
 *
 * Provides common functionality for all contract clients
 */

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Keypair,
  Address,
  xdr,
  Account,
  TimeoutInfinite,
} from '@stellar/stellar-sdk';
import type { NetworkConfig, TransactionResult, SimulationResult } from '../types';
import { scValToNative, retry } from '../utils';

export interface ContractClientConfig {
  contractId: string;
  network: NetworkConfig;
  keypair?: Keypair;
}

export abstract class BaseContractClient {
  protected contract: Contract;
  protected server: SorobanRpc.Server;
  protected network: NetworkConfig;
  protected keypair?: Keypair;

  constructor(config: ContractClientConfig) {
    this.contract = new Contract(config.contractId);
    this.server = new SorobanRpc.Server(config.network.rpcUrl);
    this.network = config.network;
    this.keypair = config.keypair;
  }

  /**
   * Get contract ID
   */
  get contractId(): string {
    return this.contract.contractId();
  }

  /**
   * Set the keypair for signing transactions
   */
  setKeypair(keypair: Keypair): void {
    this.keypair = keypair;
  }

  /**
   * Get account from keypair
   */
  protected async getAccount(): Promise<Account> {
    if (!this.keypair) {
      throw new Error('No keypair set');
    }
    return this.server.getAccount(this.keypair.publicKey());
  }

  /**
   * Build a transaction for contract invocation
   */
  protected async buildTransaction(
    method: string,
    ...args: xdr.ScVal[]
  ): Promise<TransactionBuilder> {
    const account = await this.getAccount();
    const operation = this.contract.call(method, ...args);

    return new TransactionBuilder(account, {
      fee: '100000', // Will be adjusted after simulation
      networkPassphrase: this.network.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(TimeoutInfinite);
  }

  /**
   * Simulate a contract call
   */
  protected async simulate<T>(
    method: string,
    ...args: xdr.ScVal[]
  ): Promise<SimulationResult<T>> {
    const tx = await this.buildTransaction(method, ...args);
    const builtTx = tx.build();

    const simulation = await this.server.simulateTransaction(builtTx);

    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    if (!SorobanRpc.Api.isSimulationSuccess(simulation)) {
      throw new Error('Simulation did not succeed');
    }

    const result = simulation.result?.retval;
    if (!result) {
      throw new Error('No result from simulation');
    }

    return {
      result: scValToNative(result) as T,
      minResourceFee: BigInt(simulation.minResourceFee),
      transactionData: simulation.transactionData.build().toXDR('base64'),
    };
  }

  /**
   * Execute a contract call (sign and submit)
   */
  protected async execute<T>(
    method: string,
    ...args: xdr.ScVal[]
  ): Promise<TransactionResult<T>> {
    if (!this.keypair) {
      throw new Error('No keypair set for signing');
    }

    const tx = await this.buildTransaction(method, ...args);
    const builtTx = tx.build();

    // Simulate first to get footprint and fees
    const simulation = await this.server.simulateTransaction(builtTx);

    if (SorobanRpc.Api.isSimulationError(simulation)) {
      return {
        status: 'failed',
        error: `Simulation failed: ${simulation.error}`,
      };
    }

    if (!SorobanRpc.Api.isSimulationSuccess(simulation)) {
      return {
        status: 'failed',
        error: 'Simulation did not succeed',
      };
    }

    // Assemble transaction with simulation data
    const preparedTx = SorobanRpc.assembleTransaction(builtTx, simulation).build();
    preparedTx.sign(this.keypair);

    // Submit transaction
    const sendResponse = await this.server.sendTransaction(preparedTx);

    if (sendResponse.status === 'ERROR') {
      return {
        status: 'failed',
        error: sendResponse.errorResult?.toXDR('base64') || 'Unknown error',
      };
    }

    // Wait for transaction to be included
    const txHash = sendResponse.hash;
    const result = await retry(
      async () => {
        const response = await this.server.getTransaction(txHash);
        if (response.status === 'NOT_FOUND') {
          throw new Error('Transaction not found yet');
        }
        return response;
      },
      10,
      2000
    );

    if (result.status === 'SUCCESS') {
      let returnValue: T | undefined;
      if (result.returnValue) {
        returnValue = scValToNative(result.returnValue) as T;
      }

      return {
        status: 'success',
        hash: txHash,
        result: returnValue,
        ledger: result.ledger,
      };
    }

    return {
      status: 'failed',
      hash: txHash,
      error: 'Transaction failed',
    };
  }

  /**
   * Call a read-only contract method
   */
  protected async call<T>(method: string, ...args: xdr.ScVal[]): Promise<T> {
    const simulation = await this.simulate<T>(method, ...args);
    return simulation.result;
  }

  /**
   * Convert address string to ScVal
   */
  protected addressToScVal(address: string): xdr.ScVal {
    return Address.fromString(address).toScVal();
  }

  /**
   * Convert i128 to ScVal
   */
  protected i128ToScVal(value: bigint): xdr.ScVal {
    return xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        lo: xdr.Uint64.fromString((value & BigInt('0xFFFFFFFFFFFFFFFF')).toString()),
        hi: xdr.Int64.fromString((value >> 64n).toString()),
      })
    );
  }

  /**
   * Convert u32 to ScVal
   */
  protected u32ToScVal(value: number): xdr.ScVal {
    return xdr.ScVal.scvU32(value);
  }

  /**
   * Convert symbol to ScVal
   */
  protected symbolToScVal(value: string): xdr.ScVal {
    return xdr.ScVal.scvSymbol(value);
  }

  /**
   * Convert array to ScVal Vec
   */
  protected vecToScVal(values: xdr.ScVal[]): xdr.ScVal {
    return xdr.ScVal.scvVec(values);
  }
}
