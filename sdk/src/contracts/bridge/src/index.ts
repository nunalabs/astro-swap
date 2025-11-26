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
 * Storage keys for the bridge contract
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "Initialized", values: void} | {tag: "Paused", values: void} | {tag: "Factory", values: void} | {tag: "Staking", values: void} | {tag: "Launchpad", values: void} | {tag: "QuoteToken", values: void} | {tag: "GraduationCount", values: void} | {tag: "GraduatedToken", values: readonly [string]} | {tag: "GraduationIndex", values: readonly [u32]};

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
   * Construct and simulate a staking transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get staking address
   */
  staking: (options?: {
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
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if bridge is paused
   */
  is_paused: (options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a launchpad transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get launchpad address
   */
  launchpad: (options?: {
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
  }) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer admin role
   */
  set_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: {
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
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the bridge contract
   * 
   * # Arguments
   * * `admin` - Admin address for emergency functions
   * * `factory` - AstroSwap factory contract address
   * * `staking` - AstroSwap staking contract address
   * * `launchpad` - Astro-Shiba launchpad contract address
   * * `quote_token` - Quote token for pairs (XLM wrapper or USDC)
   */
  initialize: ({admin, factory, staking, launchpad, quote_token}: {admin: string, factory: string, staking: string, launchpad: string, quote_token: string}, options?: {
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
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause or unpause the bridge
   */
  set_paused: ({admin, paused}: {admin: string, paused: boolean}, options?: {
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
   * Construct and simulate a quote_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get quote token address
   */
  quote_token: (options?: {
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
  }) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_staking transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update staking address
   */
  set_staking: ({admin, staking}: {admin: string, staking: string}, options?: {
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
   * Construct and simulate a is_graduated transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a token has graduated
   */
  is_graduated: ({token}: {token: string}, options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_launchpad transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update launchpad address
   */
  set_launchpad: ({admin, launchpad}: {admin: string, launchpad: string}, options?: {
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
   * Construct and simulate a graduate_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Graduate a token from Astro-Shiba launchpad
   * 
   * This is the main function called by the launchpad when a token
   * reaches the graduation threshold. It:
   * 1. Creates a trading pair on AstroSwap
   * 2. Adds initial liquidity
   * 3. Burns LP tokens (permanent liquidity lock)
   * 4. Creates a staking pool for the pair
   * 
   * # Arguments
   * * `caller` - Must be the registered launchpad contract
   * * `token` - The graduated token address
   * * `token_amount` - Amount of graduated token for liquidity
   * * `quote_amount` - Amount of quote token (XLM) for liquidity
   * * `metadata` - Token metadata from launchpad
   * 
   * # Returns
   * * `GraduatedToken` - Information about the graduated token
   */
  graduate_token: ({caller, token, token_amount, quote_amount, metadata}: {caller: string, token: string, token_amount: i128, quote_amount: i128, metadata: TokenMetadata}, options?: {
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
  }) => Promise<AssembledTransaction<Result<GraduatedToken>>>

  /**
   * Construct and simulate a set_quote_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update quote token address
   */
  set_quote_token: ({admin, quote_token}: {admin: string, quote_token: string}, options?: {
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
   * Construct and simulate a graduation_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total number of graduated tokens
   */
  graduation_count: (options?: {
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
  }) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_graduated_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get information about a graduated token
   */
  get_graduated_token: ({token}: {token: string}, options?: {
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
  }) => Promise<AssembledTransaction<Result<GraduatedToken>>>

  /**
   * Construct and simulate a get_graduation_by_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get graduated token by index
   */
  get_graduation_by_index: ({index}: {index: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Result<GraduatedToken>>>

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
      new ContractSpec([ "AAAAAAAAABFHZXQgYWRtaW4gYWRkcmVzcwAAAAAAAAVhZG1pbgAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABNHZXQgZmFjdG9yeSBhZGRyZXNzAAAAAAdmYWN0b3J5AAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABNHZXQgc3Rha2luZyBhZGRyZXNzAAAAAAdzdGFraW5nAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABlDaGVjayBpZiBicmlkZ2UgaXMgcGF1c2VkAAAAAAAACWlzX3BhdXNlZAAAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAABVHZXQgbGF1bmNocGFkIGFkZHJlc3MAAAAAAAAJbGF1bmNocGFkAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAABNUcmFuc2ZlciBhZG1pbiByb2xlAAAAAAlzZXRfYWRtaW4AAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAATRJbml0aWFsaXplIHRoZSBicmlkZ2UgY29udHJhY3QKCiMgQXJndW1lbnRzCiogYGFkbWluYCAtIEFkbWluIGFkZHJlc3MgZm9yIGVtZXJnZW5jeSBmdW5jdGlvbnMKKiBgZmFjdG9yeWAgLSBBc3Ryb1N3YXAgZmFjdG9yeSBjb250cmFjdCBhZGRyZXNzCiogYHN0YWtpbmdgIC0gQXN0cm9Td2FwIHN0YWtpbmcgY29udHJhY3QgYWRkcmVzcwoqIGBsYXVuY2hwYWRgIC0gQXN0cm8tU2hpYmEgbGF1bmNocGFkIGNvbnRyYWN0IGFkZHJlc3MKKiBgcXVvdGVfdG9rZW5gIC0gUXVvdGUgdG9rZW4gZm9yIHBhaXJzIChYTE0gd3JhcHBlciBvciBVU0RDKQAAAAppbml0aWFsaXplAAAAAAAFAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAB2ZhY3RvcnkAAAAAEwAAAAAAAAAHc3Rha2luZwAAAAATAAAAAAAAAAlsYXVuY2hwYWQAAAAAAAATAAAAAAAAAAtxdW90ZV90b2tlbgAAAAATAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABtQYXVzZSBvciB1bnBhdXNlIHRoZSBicmlkZ2UAAAAACnNldF9wYXVzZWQAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABdHZXQgcXVvdGUgdG9rZW4gYWRkcmVzcwAAAAALcXVvdGVfdG9rZW4AAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAABZVcGRhdGUgc3Rha2luZyBhZGRyZXNzAAAAAAALc2V0X3N0YWtpbmcAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdzdGFraW5nAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAB5DaGVjayBpZiBhIHRva2VuIGhhcyBncmFkdWF0ZWQAAAAAAAxpc19ncmFkdWF0ZWQAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAABhVcGRhdGUgbGF1bmNocGFkIGFkZHJlc3MAAAANc2V0X2xhdW5jaHBhZAAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJbGF1bmNocGFkAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAAn5HcmFkdWF0ZSBhIHRva2VuIGZyb20gQXN0cm8tU2hpYmEgbGF1bmNocGFkCgpUaGlzIGlzIHRoZSBtYWluIGZ1bmN0aW9uIGNhbGxlZCBieSB0aGUgbGF1bmNocGFkIHdoZW4gYSB0b2tlbgpyZWFjaGVzIHRoZSBncmFkdWF0aW9uIHRocmVzaG9sZC4gSXQ6CjEuIENyZWF0ZXMgYSB0cmFkaW5nIHBhaXIgb24gQXN0cm9Td2FwCjIuIEFkZHMgaW5pdGlhbCBsaXF1aWRpdHkKMy4gQnVybnMgTFAgdG9rZW5zIChwZXJtYW5lbnQgbGlxdWlkaXR5IGxvY2spCjQuIENyZWF0ZXMgYSBzdGFraW5nIHBvb2wgZm9yIHRoZSBwYWlyCgojIEFyZ3VtZW50cwoqIGBjYWxsZXJgIC0gTXVzdCBiZSB0aGUgcmVnaXN0ZXJlZCBsYXVuY2hwYWQgY29udHJhY3QKKiBgdG9rZW5gIC0gVGhlIGdyYWR1YXRlZCB0b2tlbiBhZGRyZXNzCiogYHRva2VuX2Ftb3VudGAgLSBBbW91bnQgb2YgZ3JhZHVhdGVkIHRva2VuIGZvciBsaXF1aWRpdHkKKiBgcXVvdGVfYW1vdW50YCAtIEFtb3VudCBvZiBxdW90ZSB0b2tlbiAoWExNKSBmb3IgbGlxdWlkaXR5CiogYG1ldGFkYXRhYCAtIFRva2VuIG1ldGFkYXRhIGZyb20gbGF1bmNocGFkCgojIFJldHVybnMKKiBgR3JhZHVhdGVkVG9rZW5gIC0gSW5mb3JtYXRpb24gYWJvdXQgdGhlIGdyYWR1YXRlZCB0b2tlbgAAAAAADmdyYWR1YXRlX3Rva2VuAAAAAAAFAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAMdG9rZW5fYW1vdW50AAAACwAAAAAAAAAMcXVvdGVfYW1vdW50AAAACwAAAAAAAAAIbWV0YWRhdGEAAAfQAAAADVRva2VuTWV0YWRhdGEAAAAAAAABAAAD6QAAB9AAAAAOR3JhZHVhdGVkVG9rZW4AAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABpVcGRhdGUgcXVvdGUgdG9rZW4gYWRkcmVzcwAAAAAAD3NldF9xdW90ZV90b2tlbgAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAC3F1b3RlX3Rva2VuAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAACRHZXQgdG90YWwgbnVtYmVyIG9mIGdyYWR1YXRlZCB0b2tlbnMAAAAQZ3JhZHVhdGlvbl9jb3VudAAAAAAAAAABAAAABA==",
        "AAAAAAAAACdHZXQgaW5mb3JtYXRpb24gYWJvdXQgYSBncmFkdWF0ZWQgdG9rZW4AAAAAE2dldF9ncmFkdWF0ZWRfdG9rZW4AAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAA+kAAAfQAAAADkdyYWR1YXRlZFRva2VuAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABxHZXQgZ3JhZHVhdGVkIHRva2VuIGJ5IGluZGV4AAAAF2dldF9ncmFkdWF0aW9uX2J5X2luZGV4AAAAAAEAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAPpAAAH0AAAAA5HcmFkdWF0ZWRUb2tlbgAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAgAAACRTdG9yYWdlIGtleXMgZm9yIHRoZSBicmlkZ2UgY29udHJhY3QAAAAAAAAAB0RhdGFLZXkAAAAACgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAAGUGF1c2VkAAAAAAAAAAAAAAAAAAdGYWN0b3J5AAAAAAAAAAAAAAAAB1N0YWtpbmcAAAAAAAAAAAAAAAAJTGF1bmNocGFkAAAAAAAAAAAAAAAAAAAKUXVvdGVUb2tlbgAAAAAAAAAAAAAAAAAPR3JhZHVhdGlvbkNvdW50AAAAAAEAAAAAAAAADkdyYWR1YXRlZFRva2VuAAAAAAABAAAAEwAAAAEAAAAAAAAAD0dyYWR1YXRpb25JbmRleAAAAAABAAAABA==",
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
        factory: this.txFromJSON<string>,
        staking: this.txFromJSON<string>,
        is_paused: this.txFromJSON<boolean>,
        launchpad: this.txFromJSON<Option<string>>,
        set_admin: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        quote_token: this.txFromJSON<Option<string>>,
        set_staking: this.txFromJSON<Result<void>>,
        is_graduated: this.txFromJSON<boolean>,
        set_launchpad: this.txFromJSON<Result<void>>,
        graduate_token: this.txFromJSON<Result<GraduatedToken>>,
        set_quote_token: this.txFromJSON<Result<void>>,
        graduation_count: this.txFromJSON<u32>,
        get_graduated_token: this.txFromJSON<Result<GraduatedToken>>,
        get_graduation_by_index: this.txFromJSON<Result<GraduatedToken>>
  }
}