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
 * Storage keys for the factory contract
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "FeeRecipient", values: void} | {tag: "ProtocolFeeBps", values: void} | {tag: "PairWasmHash", values: void} | {tag: "Initialized", values: void} | {tag: "Paused", values: void} | {tag: "PairsCount", values: void} | {tag: "LaunchpadAddress", values: void} | {tag: "Pair", values: readonly [string, string]} | {tag: "AllPairs", values: readonly [u32]} | {tag: "GraduatedToken", values: readonly [string]};


/**
 * Information about a graduated token
 */
export interface GraduatedTokenInfo {
  graduation_time: u64;
  metadata: TokenMetadata;
  pair: string;
  token: string;
}

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
   * Get the admin address
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
   * Construct and simulate a fee_to transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the fee recipient address
   */
  fee_to: (options?: {
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
   * Construct and simulate a get_pair transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the pair address for two tokens
   */
  get_pair: ({token_a, token_b}: {token_a: string, token_b: string}, options?: {
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
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if the factory is paused
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
   * Get the launchpad address
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
   * Transfer admin role to new address
   * Only current admin can call
   */
  set_admin: ({caller, new_admin}: {caller: string, new_admin: string}, options?: {
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
   * Initialize the factory contract
   * Can only be called once
   */
  initialize: ({admin, pair_wasm_hash, protocol_fee_bps}: {admin: string, pair_wasm_hash: Buffer, protocol_fee_bps: u32}, options?: {
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
   * Construct and simulate a set_fee_to transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the fee recipient address
   * Only admin can call
   */
  set_fee_to: ({caller, recipient}: {caller: string, recipient: string}, options?: {
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
   * Pause or unpause the factory
   * Only admin can call
   */
  set_paused: ({caller, paused}: {caller: string, paused: boolean}, options?: {
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
   * Construct and simulate a create_pair transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new trading pair
   * Returns the address of the new pair contract
   */
  create_pair: ({token_a, token_b}: {token_a: string, token_b: string}, options?: {
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
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a pair_exists transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a pair exists
   */
  pair_exists: ({token_a, token_b}: {token_a: string, token_b: string}, options?: {
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
   * Construct and simulate a is_graduated transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a token has graduated from Astro-Shiba
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
   * Set the Astro-Shiba launchpad address
   * Only admin can call
   */
  set_launchpad: ({caller, launchpad}: {caller: string, launchpad: string}, options?: {
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
   * Construct and simulate a all_pairs_length transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total number of pairs
   */
  all_pairs_length: (options?: {
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
   * Construct and simulate a protocol_fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the protocol fee in basis points
   */
  protocol_fee_bps: (options?: {
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
   * Construct and simulate a set_protocol_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the protocol fee in basis points
   * Only admin can call
   */
  set_protocol_fee: ({caller, fee_bps}: {caller: string, fee_bps: u32}, options?: {
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
   * Construct and simulate a get_pair_by_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pair by index
   */
  get_pair_by_index: ({index}: {index: u32}, options?: {
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
   * Construct and simulate a set_pair_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the pair WASM hash for future deployments
   * Only admin can call
   */
  set_pair_wasm_hash: ({caller, wasm_hash}: {caller: string, wasm_hash: Buffer}, options?: {
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
   * Construct and simulate a create_graduated_pair transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a pair for a graduated token with initial liquidity
   * Only launchpad contract can call
   */
  create_graduated_pair: ({caller, token, quote_token}: {caller: string, token: string, quote_token: string}, options?: {
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
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a register_graduated_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a graduated token from Astro-Shiba launchpad
   * Only launchpad contract can call
   */
  register_graduated_token: ({caller, token, metadata}: {caller: string, token: string, metadata: TokenMetadata}, options?: {
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
      new ContractSpec([ "AAAAAgAAACVTdG9yYWdlIGtleXMgZm9yIHRoZSBmYWN0b3J5IGNvbnRyYWN0AAAAAAAAAAAAAAdEYXRhS2V5AAAAAAsAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAADEZlZVJlY2lwaWVudAAAAAAAAAAAAAAADlByb3RvY29sRmVlQnBzAAAAAAAAAAAAAAAAAAxQYWlyV2FzbUhhc2gAAAAAAAAAAAAAAAtJbml0aWFsaXplZAAAAAAAAAAAAAAAAAZQYXVzZWQAAAAAAAAAAAAAAAAAClBhaXJzQ291bnQAAAAAAAAAAAAAAAAAEExhdW5jaHBhZEFkZHJlc3MAAAABAAAAAAAAAARQYWlyAAAAAgAAABMAAAATAAAAAQAAAAAAAAAIQWxsUGFpcnMAAAABAAAABAAAAAEAAAAAAAAADkdyYWR1YXRlZFRva2VuAAAAAAABAAAAEw==",
        "AAAAAQAAACNJbmZvcm1hdGlvbiBhYm91dCBhIGdyYWR1YXRlZCB0b2tlbgAAAAAAAAAAEkdyYWR1YXRlZFRva2VuSW5mbwAAAAAABAAAAAAAAAAPZ3JhZHVhdGlvbl90aW1lAAAAAAYAAAAAAAAACG1ldGFkYXRhAAAH0AAAAA1Ub2tlbk1ldGFkYXRhAAAAAAAAAAAAAARwYWlyAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAAAAABVHZXQgdGhlIGFkbWluIGFkZHJlc3MAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAB1HZXQgdGhlIGZlZSByZWNpcGllbnQgYWRkcmVzcwAAAAAAAAZmZWVfdG8AAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAACNHZXQgdGhlIHBhaXIgYWRkcmVzcyBmb3IgdHdvIHRva2VucwAAAAAIZ2V0X3BhaXIAAAACAAAAAAAAAAd0b2tlbl9hAAAAABMAAAAAAAAAB3Rva2VuX2IAAAAAEwAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAB5DaGVjayBpZiB0aGUgZmFjdG9yeSBpcyBwYXVzZWQAAAAAAAlpc19wYXVzZWQAAAAAAAAAAAAAAQAAAAE=",
        "AAAAAAAAABlHZXQgdGhlIGxhdW5jaHBhZCBhZGRyZXNzAAAAAAAACWxhdW5jaHBhZAAAAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAAD5UcmFuc2ZlciBhZG1pbiByb2xlIHRvIG5ldyBhZGRyZXNzCk9ubHkgY3VycmVudCBhZG1pbiBjYW4gY2FsbAAAAAAACXNldF9hZG1pbgAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAADdJbml0aWFsaXplIHRoZSBmYWN0b3J5IGNvbnRyYWN0CkNhbiBvbmx5IGJlIGNhbGxlZCBvbmNlAAAAAAppbml0aWFsaXplAAAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAADnBhaXJfd2FzbV9oYXNoAAAAAAPuAAAAIAAAAAAAAAAQcHJvdG9jb2xfZmVlX2JwcwAAAAQAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAADFTZXQgdGhlIGZlZSByZWNpcGllbnQgYWRkcmVzcwpPbmx5IGFkbWluIGNhbiBjYWxsAAAAAAAACnNldF9mZWVfdG8AAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAADBQYXVzZSBvciB1bnBhdXNlIHRoZSBmYWN0b3J5Ck9ubHkgYWRtaW4gY2FuIGNhbGwAAAAKc2V0X3BhdXNlZAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZwYXVzZWQAAAAAAAEAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAEZDcmVhdGUgYSBuZXcgdHJhZGluZyBwYWlyClJldHVybnMgdGhlIGFkZHJlc3Mgb2YgdGhlIG5ldyBwYWlyIGNvbnRyYWN0AAAAAAALY3JlYXRlX3BhaXIAAAAAAgAAAAAAAAAHdG9rZW5fYQAAAAATAAAAAAAAAAd0b2tlbl9iAAAAABMAAAABAAAD6QAAABMAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABZDaGVjayBpZiBhIHBhaXIgZXhpc3RzAAAAAAALcGFpcl9leGlzdHMAAAAAAgAAAAAAAAAHdG9rZW5fYQAAAAATAAAAAAAAAAd0b2tlbl9iAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAC9DaGVjayBpZiBhIHRva2VuIGhhcyBncmFkdWF0ZWQgZnJvbSBBc3Ryby1TaGliYQAAAAAMaXNfZ3JhZHVhdGVkAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAADlTZXQgdGhlIEFzdHJvLVNoaWJhIGxhdW5jaHBhZCBhZGRyZXNzCk9ubHkgYWRtaW4gY2FuIGNhbGwAAAAAAAANc2V0X2xhdW5jaHBhZAAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJbGF1bmNocGFkAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABlHZXQgdG90YWwgbnVtYmVyIG9mIHBhaXJzAAAAAAAAEGFsbF9wYWlyc19sZW5ndGgAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAACRHZXQgdGhlIHByb3RvY29sIGZlZSBpbiBiYXNpcyBwb2ludHMAAAAQcHJvdG9jb2xfZmVlX2JwcwAAAAAAAAABAAAABA==",
        "AAAAAAAAADhTZXQgdGhlIHByb3RvY29sIGZlZSBpbiBiYXNpcyBwb2ludHMKT25seSBhZG1pbiBjYW4gY2FsbAAAABBzZXRfcHJvdG9jb2xfZmVlAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABFHZXQgcGFpciBieSBpbmRleAAAAAAAABFnZXRfcGFpcl9ieV9pbmRleAAAAAAAAAEAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAERVcGRhdGUgdGhlIHBhaXIgV0FTTSBoYXNoIGZvciBmdXR1cmUgZGVwbG95bWVudHMKT25seSBhZG1pbiBjYW4gY2FsbAAAABJzZXRfcGFpcl93YXNtX2hhc2gAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAFtDcmVhdGUgYSBwYWlyIGZvciBhIGdyYWR1YXRlZCB0b2tlbiB3aXRoIGluaXRpYWwgbGlxdWlkaXR5Ck9ubHkgbGF1bmNocGFkIGNvbnRyYWN0IGNhbiBjYWxsAAAAABVjcmVhdGVfZ3JhZHVhdGVkX3BhaXIAAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAALcXVvdGVfdG9rZW4AAAAAEwAAAAEAAAPpAAAAEwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAFZSZWdpc3RlciBhIGdyYWR1YXRlZCB0b2tlbiBmcm9tIEFzdHJvLVNoaWJhIGxhdW5jaHBhZApPbmx5IGxhdW5jaHBhZCBjb250cmFjdCBjYW4gY2FsbAAAAAAAGHJlZ2lzdGVyX2dyYWR1YXRlZF90b2tlbgAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAhtZXRhZGF0YQAAB9AAAAANVG9rZW5NZXRhZGF0YQAAAAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
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
        fee_to: this.txFromJSON<Option<string>>,
        get_pair: this.txFromJSON<Option<string>>,
        is_paused: this.txFromJSON<boolean>,
        launchpad: this.txFromJSON<Option<string>>,
        set_admin: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        set_fee_to: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        create_pair: this.txFromJSON<Result<string>>,
        pair_exists: this.txFromJSON<boolean>,
        is_graduated: this.txFromJSON<boolean>,
        set_launchpad: this.txFromJSON<Result<void>>,
        all_pairs_length: this.txFromJSON<u32>,
        protocol_fee_bps: this.txFromJSON<u32>,
        set_protocol_fee: this.txFromJSON<Result<void>>,
        get_pair_by_index: this.txFromJSON<Option<string>>,
        set_pair_wasm_hash: this.txFromJSON<Result<void>>,
        create_graduated_pair: this.txFromJSON<Result<string>>,
        register_graduated_token: this.txFromJSON<Result<void>>
  }
}