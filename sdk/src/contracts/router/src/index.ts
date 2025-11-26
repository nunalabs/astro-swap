import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




/**
 * Storage keys for the router contract
 */
export type DataKey = {tag: "Factory", values: void} | {tag: "Admin", values: void} | {tag: "Initialized", values: void};

/**
 * Error codes for AstroSwap contracts
 */
export const AstroSwapError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidArgument"},
  5: {message:"Overflow"},
  6: {message:"Underflow"},
  7: {message:"DivisionByZero"},
  100: {message:"InvalidToken"},
  101: {message:"SameToken"},
  102: {message:"InsufficientBalance"},
  103: {message:"InsufficientAllowance"},
  104: {message:"TransferFailed"},
  200: {message:"InsufficientLiquidity"},
  201: {message:"InvalidAmount"},
  202: {message:"InsufficientShares"},
  203: {message:"MinimumNotMet"},
  204: {message:"PoolNotFound"},
  205: {message:"PairExists"},
  206: {message:"PairNotFound"},
  300: {message:"SlippageExceeded"},
  301: {message:"DeadlineExpired"},
  302: {message:"InsufficientOutputAmount"},
  303: {message:"ExcessiveInputAmount"},
  304: {message:"InvalidPath"},
  305: {message:"PriceImpactTooHigh"},
  400: {message:"StakingPoolNotFound"},
  401: {message:"InsufficientStake"},
  402: {message:"StakingNotStarted"},
  403: {message:"StakingEnded"},
  404: {message:"NoRewardsAvailable"},
  405: {message:"InvalidStakingPeriod"},
  406: {message:"StakeNotFound"},
  500: {message:"InvalidFee"},
  501: {message:"FeeTooHigh"},
  502: {message:"TimelockNotExpired"},
  503: {message:"InvalidAdmin"},
  504: {message:"ContractPaused"},
  600: {message:"ProtocolNotFound"},
  601: {message:"InvalidRoute"},
  602: {message:"RouteNotFound"},
  603: {message:"AdapterError"},
  700: {message:"TokenNotGraduated"},
  701: {message:"AlreadyGraduated"},
  702: {message:"InvalidLaunchpad"},
  703: {message:"GraduationFailed"}
}


/**
 * Information about a trading pair
 */
export interface PairInfo {
  fee_bps: u32;
  reserve_a: i128;
  reserve_b: i128;
  token_a: string;
  token_b: string;
  total_shares: i128;
}

/**
 * Protocol identifiers for aggregator
 */
export enum Protocol {
  AstroSwap = 0,
  Soroswap = 1,
  Phoenix = 2,
  Aqua = 3,
}


/**
 * Route step for aggregator
 */
export interface RouteStep {
  amount_in: i128;
  expected_out: i128;
  pool_address: string;
  protocol_id: u32;
  token_in: string;
  token_out: string;
}


/**
 * Complete swap route
 */
export interface SwapRoute {
  expected_output: i128;
  steps: Array<RouteStep>;
  total_fee_bps: u32;
}


/**
 * User's staking information
 */
export interface UserStake {
  amount: i128;
  multiplier: u32;
  reward_debt: i128;
  stake_time: u64;
}


/**
 * Staking pool information
 */
export interface StakingPool {
  acc_reward_per_share: i128;
  end_time: u64;
  last_update_time: u64;
  lp_token: string;
  pool_id: u32;
  reward_per_second: i128;
  reward_token: string;
  start_time: u64;
  total_staked: i128;
}


/**
 * Token metadata for graduated tokens from Astro-Shiba
 */
export interface TokenMetadata {
  creator: string;
  decimals: u32;
  graduation_time: u64;
  name: string;
  symbol: string;
  total_supply: i128;
}


/**
 * Graduation status for tokens from Astro-Shiba
 */
export interface GraduatedToken {
  graduation_time: u64;
  initial_price: i128;
  metadata: TokenMetadata;
  pair: string;
  staking_pool_id: u32;
  token: string;
}


/**
 * User's position in a liquidity pool
 */
export interface LiquidityPosition {
  pair: string;
  shares: i128;
  timestamp: u64;
  token_a_deposited: i128;
  token_b_deposited: i128;
}

export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get admin address
   */
  admin: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a quote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Quote: given some amount of token A, calculate optimal amount of token B
   */
  quote: ({amount_a, reserve_a, reserve_b}: {amount_a: i128, reserve_a: i128, reserve_b: i128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a factory transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get factory address
   */
  factory: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the router contract
   */
  initialize: ({factory, admin}: {factory: string, admin: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a add_liquidity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add liquidity to a pair
   */
  add_liquidity: ({user, token_a, token_b, amount_a_desired, amount_b_desired, amount_a_min, amount_b_min, deadline}: {user: string, token_a: string, token_b: string, amount_a_desired: i128, amount_b_desired: i128, amount_a_min: i128, amount_b_min: i128, deadline: u64}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<readonly [i128, i128, i128]>>>

  /**
   * Construct and simulate a remove_liquidity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove liquidity from a pair
   */
  remove_liquidity: ({user, token_a, token_b, liquidity, amount_a_min, amount_b_min, deadline}: {user: string, token_a: string, token_b: string, liquidity: i128, amount_a_min: i128, amount_b_min: i128, deadline: u64}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>

  /**
   * Construct and simulate a swap_exact_tokens_for_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Swap exact tokens for tokens
   * Swaps a fixed amount of input tokens for as many output tokens as possible
   * 
   * # Arguments
   * * `user` - The address executing the swap
   * * `amount_in` - Exact amount of input tokens
   * * `amount_out_min` - Minimum amount of output tokens (slippage protection)
   * * `path` - Vector of token addresses [tokenIn, ..., tokenOut]
   * * `deadline` - Timestamp after which the transaction reverts
   * 
   * # Returns
   * * Vector of amounts for each swap in the path
   */
  swap_exact_tokens_for_tokens: ({user, amount_in, amount_out_min, path, deadline}: {user: string, amount_in: i128, amount_out_min: i128, path: Array<string>, deadline: u64}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Array<i128>>>>

  /**
   * Construct and simulate a swap_tokens_for_exact_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Swap tokens for exact tokens
   * Swaps as few input tokens as possible for a fixed amount of output tokens
   */
  swap_tokens_for_exact_tokens: ({user, amount_out, amount_in_max, path, deadline}: {user: string, amount_out: i128, amount_in_max: i128, path: Array<string>, deadline: u64}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Array<i128>>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAACRTdG9yYWdlIGtleXMgZm9yIHRoZSByb3V0ZXIgY29udHJhY3QAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAAAAAAB0ZhY3RvcnkAAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAtJbml0aWFsaXplZAA=",
        "AAAAAAAAABFHZXQgYWRtaW4gYWRkcmVzcwAAAAAAAAVhZG1pbgAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAEhRdW90ZTogZ2l2ZW4gc29tZSBhbW91bnQgb2YgdG9rZW4gQSwgY2FsY3VsYXRlIG9wdGltYWwgYW1vdW50IG9mIHRva2VuIEIAAAAFcXVvdGUAAAAAAAADAAAAAAAAAAhhbW91bnRfYQAAAAsAAAAAAAAACXJlc2VydmVfYQAAAAAAAAsAAAAAAAAACXJlc2VydmVfYgAAAAAAAAsAAAABAAAD6QAAAAsAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABNHZXQgZmFjdG9yeSBhZGRyZXNzAAAAAAdmYWN0b3J5AAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAB5Jbml0aWFsaXplIHRoZSByb3V0ZXIgY29udHJhY3QAAAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAAdmYWN0b3J5AAAAABMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABdBZGQgbGlxdWlkaXR5IHRvIGEgcGFpcgAAAAANYWRkX2xpcXVpZGl0eQAAAAAAAAgAAAAAAAAABHVzZXIAAAATAAAAAAAAAAd0b2tlbl9hAAAAABMAAAAAAAAAB3Rva2VuX2IAAAAAEwAAAAAAAAAQYW1vdW50X2FfZGVzaXJlZAAAAAsAAAAAAAAAEGFtb3VudF9iX2Rlc2lyZWQAAAALAAAAAAAAAAxhbW91bnRfYV9taW4AAAALAAAAAAAAAAxhbW91bnRfYl9taW4AAAALAAAAAAAAAAhkZWFkbGluZQAAAAYAAAABAAAD6QAAA+0AAAADAAAACwAAAAsAAAALAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABxSZW1vdmUgbGlxdWlkaXR5IGZyb20gYSBwYWlyAAAAEHJlbW92ZV9saXF1aWRpdHkAAAAHAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAHdG9rZW5fYQAAAAATAAAAAAAAAAd0b2tlbl9iAAAAABMAAAAAAAAACWxpcXVpZGl0eQAAAAAAAAsAAAAAAAAADGFtb3VudF9hX21pbgAAAAsAAAAAAAAADGFtb3VudF9iX21pbgAAAAsAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAPpAAAD7QAAAAIAAAALAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAcpTd2FwIGV4YWN0IHRva2VucyBmb3IgdG9rZW5zClN3YXBzIGEgZml4ZWQgYW1vdW50IG9mIGlucHV0IHRva2VucyBmb3IgYXMgbWFueSBvdXRwdXQgdG9rZW5zIGFzIHBvc3NpYmxlCgojIEFyZ3VtZW50cwoqIGB1c2VyYCAtIFRoZSBhZGRyZXNzIGV4ZWN1dGluZyB0aGUgc3dhcAoqIGBhbW91bnRfaW5gIC0gRXhhY3QgYW1vdW50IG9mIGlucHV0IHRva2VucwoqIGBhbW91bnRfb3V0X21pbmAgLSBNaW5pbXVtIGFtb3VudCBvZiBvdXRwdXQgdG9rZW5zIChzbGlwcGFnZSBwcm90ZWN0aW9uKQoqIGBwYXRoYCAtIFZlY3RvciBvZiB0b2tlbiBhZGRyZXNzZXMgW3Rva2VuSW4sIC4uLiwgdG9rZW5PdXRdCiogYGRlYWRsaW5lYCAtIFRpbWVzdGFtcCBhZnRlciB3aGljaCB0aGUgdHJhbnNhY3Rpb24gcmV2ZXJ0cwoKIyBSZXR1cm5zCiogVmVjdG9yIG9mIGFtb3VudHMgZm9yIGVhY2ggc3dhcCBpbiB0aGUgcGF0aAAAAAAAHHN3YXBfZXhhY3RfdG9rZW5zX2Zvcl90b2tlbnMAAAAFAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAJYW1vdW50X2luAAAAAAAACwAAAAAAAAAOYW1vdW50X291dF9taW4AAAAAAAsAAAAAAAAABHBhdGgAAAPqAAAAEwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAQAAA+kAAAPqAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAGZTd2FwIHRva2VucyBmb3IgZXhhY3QgdG9rZW5zClN3YXBzIGFzIGZldyBpbnB1dCB0b2tlbnMgYXMgcG9zc2libGUgZm9yIGEgZml4ZWQgYW1vdW50IG9mIG91dHB1dCB0b2tlbnMAAAAAABxzd2FwX3Rva2Vuc19mb3JfZXhhY3RfdG9rZW5zAAAABQAAAAAAAAAEdXNlcgAAABMAAAAAAAAACmFtb3VudF9vdXQAAAAAAAsAAAAAAAAADWFtb3VudF9pbl9tYXgAAAAAAAALAAAAAAAAAARwYXRoAAAD6gAAABMAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAPpAAAD6gAAAAsAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAABAAAACNFcnJvciBjb2RlcyBmb3IgQXN0cm9Td2FwIGNvbnRyYWN0cwAAAAAAAAAADkFzdHJvU3dhcEVycm9yAAAAAAAtAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAAA9JbnZhbGlkQXJndW1lbnQAAAAABAAAAAAAAAAIT3ZlcmZsb3cAAAAFAAAAAAAAAAlVbmRlcmZsb3cAAAAAAAAGAAAAAAAAAA5EaXZpc2lvbkJ5WmVybwAAAAAABwAAAAAAAAAMSW52YWxpZFRva2VuAAAAZAAAAAAAAAAJU2FtZVRva2VuAAAAAAAAZQAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAABmAAAAAAAAABVJbnN1ZmZpY2llbnRBbGxvd2FuY2UAAAAAAABnAAAAAAAAAA5UcmFuc2ZlckZhaWxlZAAAAAAAaAAAAAAAAAAVSW5zdWZmaWNpZW50TGlxdWlkaXR5AAAAAAAAyAAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAMkAAAAAAAAAEkluc3VmZmljaWVudFNoYXJlcwAAAAAAygAAAAAAAAANTWluaW11bU5vdE1ldAAAAAAAAMsAAAAAAAAADFBvb2xOb3RGb3VuZAAAAMwAAAAAAAAAClBhaXJFeGlzdHMAAAAAAM0AAAAAAAAADFBhaXJOb3RGb3VuZAAAAM4AAAAAAAAAEFNsaXBwYWdlRXhjZWVkZWQAAAEsAAAAAAAAAA9EZWFkbGluZUV4cGlyZWQAAAABLQAAAAAAAAAYSW5zdWZmaWNpZW50T3V0cHV0QW1vdW50AAABLgAAAAAAAAAURXhjZXNzaXZlSW5wdXRBbW91bnQAAAEvAAAAAAAAAAtJbnZhbGlkUGF0aAAAAAEwAAAAAAAAABJQcmljZUltcGFjdFRvb0hpZ2gAAAAAATEAAAAAAAAAE1N0YWtpbmdQb29sTm90Rm91bmQAAAABkAAAAAAAAAARSW5zdWZmaWNpZW50U3Rha2UAAAAAAAGRAAAAAAAAABFTdGFraW5nTm90U3RhcnRlZAAAAAAAAZIAAAAAAAAADFN0YWtpbmdFbmRlZAAAAZMAAAAAAAAAEk5vUmV3YXJkc0F2YWlsYWJsZQAAAAABlAAAAAAAAAAUSW52YWxpZFN0YWtpbmdQZXJpb2QAAAGVAAAAAAAAAA1TdGFrZU5vdEZvdW5kAAAAAAABlgAAAAAAAAAKSW52YWxpZEZlZQAAAAAB9AAAAAAAAAAKRmVlVG9vSGlnaAAAAAAB9QAAAAAAAAASVGltZWxvY2tOb3RFeHBpcmVkAAAAAAH2AAAAAAAAAAxJbnZhbGlkQWRtaW4AAAH3AAAAAAAAAA5Db250cmFjdFBhdXNlZAAAAAAB+AAAAAAAAAAQUHJvdG9jb2xOb3RGb3VuZAAAAlgAAAAAAAAADEludmFsaWRSb3V0ZQAAAlkAAAAAAAAADVJvdXRlTm90Rm91bmQAAAAAAAJaAAAAAAAAAAxBZGFwdGVyRXJyb3IAAAJbAAAAAAAAABFUb2tlbk5vdEdyYWR1YXRlZAAAAAAAArwAAAAAAAAAEEFscmVhZHlHcmFkdWF0ZWQAAAK9AAAAAAAAABBJbnZhbGlkTGF1bmNocGFkAAACvgAAAAAAAAAQR3JhZHVhdGlvbkZhaWxlZAAAAr8=",
        "AAAAAQAAACBJbmZvcm1hdGlvbiBhYm91dCBhIHRyYWRpbmcgcGFpcgAAAAAAAAAIUGFpckluZm8AAAAGAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAACXJlc2VydmVfYQAAAAAAAAsAAAAAAAAACXJlc2VydmVfYgAAAAAAAAsAAAAAAAAAB3Rva2VuX2EAAAAAEwAAAAAAAAAHdG9rZW5fYgAAAAATAAAAAAAAAAx0b3RhbF9zaGFyZXMAAAAL",
        "AAAAAwAAACNQcm90b2NvbCBpZGVudGlmaWVycyBmb3IgYWdncmVnYXRvcgAAAAAAAAAACFByb3RvY29sAAAABAAAAAAAAAAJQXN0cm9Td2FwAAAAAAAAAAAAAAAAAAAIU29yb3N3YXAAAAABAAAAAAAAAAdQaG9lbml4AAAAAAIAAAAAAAAABEFxdWEAAAAD",
        "AAAAAQAAABlSb3V0ZSBzdGVwIGZvciBhZ2dyZWdhdG9yAAAAAAAAAAAAAAlSb3V0ZVN0ZXAAAAAAAAAGAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAxleHBlY3RlZF9vdXQAAAALAAAAAAAAAAxwb29sX2FkZHJlc3MAAAATAAAAAAAAAAtwcm90b2NvbF9pZAAAAAAEAAAAAAAAAAh0b2tlbl9pbgAAABMAAAAAAAAACXRva2VuX291dAAAAAAAABM=",
        "AAAAAQAAABNDb21wbGV0ZSBzd2FwIHJvdXRlAAAAAAAAAAAJU3dhcFJvdXRlAAAAAAAAAwAAAAAAAAAPZXhwZWN0ZWRfb3V0cHV0AAAAAAsAAAAAAAAABXN0ZXBzAAAAAAAD6gAAB9AAAAAJUm91dGVTdGVwAAAAAAAAAAAAAA10b3RhbF9mZWVfYnBzAAAAAAAABA==",
        "AAAAAQAAABpVc2VyJ3Mgc3Rha2luZyBpbmZvcm1hdGlvbgAAAAAAAAAAAAlVc2VyU3Rha2UAAAAAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACm11bHRpcGxpZXIAAAAAAAQAAAAAAAAAC3Jld2FyZF9kZWJ0AAAAAAsAAAAAAAAACnN0YWtlX3RpbWUAAAAAAAY=",
        "AAAAAQAAABhTdGFraW5nIHBvb2wgaW5mb3JtYXRpb24AAAAAAAAAC1N0YWtpbmdQb29sAAAAAAkAAAAAAAAAFGFjY19yZXdhcmRfcGVyX3NoYXJlAAAACwAAAAAAAAAIZW5kX3RpbWUAAAAGAAAAAAAAABBsYXN0X3VwZGF0ZV90aW1lAAAABgAAAAAAAAAIbHBfdG9rZW4AAAATAAAAAAAAAAdwb29sX2lkAAAAAAQAAAAAAAAAEXJld2FyZF9wZXJfc2Vjb25kAAAAAAAACwAAAAAAAAAMcmV3YXJkX3Rva2VuAAAAEwAAAAAAAAAKc3RhcnRfdGltZQAAAAAABgAAAAAAAAAMdG90YWxfc3Rha2VkAAAACw==",
        "AAAAAQAAADRUb2tlbiBtZXRhZGF0YSBmb3IgZ3JhZHVhdGVkIHRva2VucyBmcm9tIEFzdHJvLVNoaWJhAAAAAAAAAA1Ub2tlbk1ldGFkYXRhAAAAAAAABgAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAhkZWNpbWFscwAAAAQAAAAAAAAAD2dyYWR1YXRpb25fdGltZQAAAAAGAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAAx0b3RhbF9zdXBwbHkAAAAL",
        "AAAAAQAAAC1HcmFkdWF0aW9uIHN0YXR1cyBmb3IgdG9rZW5zIGZyb20gQXN0cm8tU2hpYmEAAAAAAAAAAAAADkdyYWR1YXRlZFRva2VuAAAAAAAGAAAAAAAAAA9ncmFkdWF0aW9uX3RpbWUAAAAABgAAAAAAAAANaW5pdGlhbF9wcmljZQAAAAAAAAsAAAAAAAAACG1ldGFkYXRhAAAH0AAAAA1Ub2tlbk1ldGFkYXRhAAAAAAAAAAAAAARwYWlyAAAAEwAAAAAAAAAPc3Rha2luZ19wb29sX2lkAAAAAAQAAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAQAAACNVc2VyJ3MgcG9zaXRpb24gaW4gYSBsaXF1aWRpdHkgcG9vbAAAAAAAAAAAEUxpcXVpZGl0eVBvc2l0aW9uAAAAAAAABQAAAAAAAAAEcGFpcgAAABMAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAARdG9rZW5fYV9kZXBvc2l0ZWQAAAAAAAALAAAAAAAAABF0b2tlbl9iX2RlcG9zaXRlZAAAAAAAAAs=" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<string>,
        quote: this.txFromJSON<Result<i128>>,
        factory: this.txFromJSON<string>,
        initialize: this.txFromJSON<Result<void>>,
        add_liquidity: this.txFromJSON<Result<readonly [i128, i128, i128]>>,
        remove_liquidity: this.txFromJSON<Result<readonly [i128, i128]>>,
        swap_exact_tokens_for_tokens: this.txFromJSON<Result<Array<i128>>>,
        swap_tokens_for_exact_tokens: this.txFromJSON<Result<Array<i128>>>
  }
}