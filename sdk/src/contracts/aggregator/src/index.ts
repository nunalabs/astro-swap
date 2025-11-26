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
 * Storage keys for the aggregator contract
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "Initialized", values: void} | {tag: "Paused", values: void} | {tag: "Config", values: void} | {tag: "ProtocolCount", values: void} | {tag: "Protocol", values: readonly [u32]} | {tag: "FeeRecipient", values: void};


/**
 * Protocol adapter information
 */
export interface ProtocolAdapter {
  /**
 * Default fee in basis points (for estimation)
 */
default_fee_bps: u32;
  /**
 * Factory or router address for this protocol
 */
factory_address: string;
  /**
 * Whether this protocol is active
 */
is_active: boolean;
  /**
 * Protocol ID (matches Protocol enum)
 */
protocol_id: u32;
}


/**
 * Aggregator configuration
 */
export interface AggregatorConfig {
  /**
 * Fee charged by aggregator in basis points
 */
aggregator_fee_bps: u32;
  /**
 * Maximum number of hops in a route
 */
max_hops: u32;
  /**
 * Maximum split paths for a single swap
 */
max_splits: u32;
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
   * Construct and simulate a swap transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute a swap using the best route found by the aggregator
   * 
   * # Arguments
   * * `user` - User executing the swap
   * * `token_in` - Input token address
   * * `token_out` - Output token address
   * * `amount_in` - Amount of input tokens
   * * `min_out` - Minimum output amount (slippage protection)
   * * `deadline` - Transaction deadline timestamp
   * 
   * # Returns
   * * Actual amount of output tokens received
   */
  swap: ({user, token_in, token_out, amount_in, min_out, deadline}: {user: string, token_in: string, token_out: string, amount_in: i128, min_out: i128, deadline: u64}, options?: {
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
   * Construct and simulate a config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current configuration
   */
  config: (options?: {
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
  }) => Promise<AssembledTransaction<AggregatorConfig>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if aggregator is paused
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
   * Initialize the aggregator contract
   * 
   * # Arguments
   * * `admin` - Address with admin privileges
   * * `astroswap_factory` - AstroSwap factory address (auto-registered as Protocol 0)
   */
  initialize: ({admin, astroswap_factory}: {admin: string, astroswap_factory: string}, options?: {
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
   * Construct and simulate a set_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update aggregator configuration
   */
  set_config: ({admin, max_hops, max_splits, aggregator_fee_bps}: {admin: string, max_hops: u32, max_splits: u32, aggregator_fee_bps: u32}, options?: {
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
   * Pause or unpause the aggregator
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
   * Construct and simulate a fee_recipient transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get fee recipient
   */
  fee_recipient: (options?: {
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
   * Construct and simulate a get_all_quotes transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get quotes from all registered protocols for a swap
   * 
   * Returns a vector of (protocol_id, expected_output) pairs
   */
  get_all_quotes: ({token_in, token_out, amount_in}: {token_in: string, token_out: string, amount_in: i128}, options?: {
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
  }) => Promise<AssembledTransaction<Array<readonly [u32, i128]>>>

  /**
   * Construct and simulate a protocol_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get number of registered protocols
   */
  protocol_count: (options?: {
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
   * Construct and simulate a find_best_route transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Find the best swap route across all registered protocols
   * 
   * # Arguments
   * * `token_in` - Input token address
   * * `token_out` - Output token address
   * * `amount_in` - Amount of input tokens
   * 
   * # Returns
   * * Best SwapRoute found across all protocols
   */
  find_best_route: ({token_in, token_out, amount_in}: {token_in: string, token_out: string, amount_in: i128}, options?: {
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
  }) => Promise<AssembledTransaction<Result<SwapRoute>>>

  /**
   * Construct and simulate a swap_with_route transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute a swap using a pre-computed route
   * 
   * Useful when the user already knows the optimal route
   * or wants to use a specific path
   */
  swap_with_route: ({user, route, amount_in, min_out, deadline}: {user: string, route: SwapRoute, amount_in: i128, min_out: i128, deadline: u64}, options?: {
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
   * Construct and simulate a get_protocol_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get protocol adapter info
   */
  get_protocol_info: ({protocol}: {protocol: Protocol}, options?: {
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
  }) => Promise<AssembledTransaction<Option<ProtocolAdapter>>>

  /**
   * Construct and simulate a register_protocol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a new protocol adapter
   * 
   * # Arguments
   * * `admin` - Must be contract admin
   * * `protocol` - Protocol enum variant
   * * `factory_address` - Factory or router address for the protocol
   * * `default_fee_bps` - Default fee for estimation
   */
  register_protocol: ({admin, protocol, factory_address, default_fee_bps}: {admin: string, protocol: Protocol, factory_address: string, default_fee_bps: u32}, options?: {
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
   * Construct and simulate a set_fee_recipient transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set fee recipient for aggregator fees
   */
  set_fee_recipient: ({admin, recipient}: {admin: string, recipient: string}, options?: {
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
   * Construct and simulate a get_protocol_quote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get quote from a specific protocol
   */
  get_protocol_quote: ({protocol, token_in, token_out, amount_in}: {protocol: Protocol, token_in: string, token_out: string, amount_in: i128}, options?: {
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
   * Construct and simulate a set_protocol_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Enable or disable a protocol
   */
  set_protocol_active: ({admin, protocol, is_active}: {admin: string, protocol: Protocol, is_active: boolean}, options?: {
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
      new ContractSpec([ "AAAAAAAAAXdFeGVjdXRlIGEgc3dhcCB1c2luZyB0aGUgYmVzdCByb3V0ZSBmb3VuZCBieSB0aGUgYWdncmVnYXRvcgoKIyBBcmd1bWVudHMKKiBgdXNlcmAgLSBVc2VyIGV4ZWN1dGluZyB0aGUgc3dhcAoqIGB0b2tlbl9pbmAgLSBJbnB1dCB0b2tlbiBhZGRyZXNzCiogYHRva2VuX291dGAgLSBPdXRwdXQgdG9rZW4gYWRkcmVzcwoqIGBhbW91bnRfaW5gIC0gQW1vdW50IG9mIGlucHV0IHRva2VucwoqIGBtaW5fb3V0YCAtIE1pbmltdW0gb3V0cHV0IGFtb3VudCAoc2xpcHBhZ2UgcHJvdGVjdGlvbikKKiBgZGVhZGxpbmVgIC0gVHJhbnNhY3Rpb24gZGVhZGxpbmUgdGltZXN0YW1wCgojIFJldHVybnMKKiBBY3R1YWwgYW1vdW50IG9mIG91dHB1dCB0b2tlbnMgcmVjZWl2ZWQAAAAABHN3YXAAAAAGAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAIdG9rZW5faW4AAAATAAAAAAAAAAl0b2tlbl9vdXQAAAAAAAATAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAdtaW5fb3V0AAAAAAsAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAPpAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABFHZXQgYWRtaW4gYWRkcmVzcwAAAAAAAAVhZG1pbgAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABlHZXQgY3VycmVudCBjb25maWd1cmF0aW9uAAAAAAAABmNvbmZpZwAAAAAAAAAAAAEAAAfQAAAAEEFnZ3JlZ2F0b3JDb25maWc=",
        "AAAAAAAAAB1DaGVjayBpZiBhZ2dyZWdhdG9yIGlzIHBhdXNlZAAAAAAAAAlpc19wYXVzZWQAAAAAAAAAAAAAAQAAAAE=",
        "AAAAAAAAABNUcmFuc2ZlciBhZG1pbiByb2xlAAAAAAlzZXRfYWRtaW4AAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAKtJbml0aWFsaXplIHRoZSBhZ2dyZWdhdG9yIGNvbnRyYWN0CgojIEFyZ3VtZW50cwoqIGBhZG1pbmAgLSBBZGRyZXNzIHdpdGggYWRtaW4gcHJpdmlsZWdlcwoqIGBhc3Ryb3N3YXBfZmFjdG9yeWAgLSBBc3Ryb1N3YXAgZmFjdG9yeSBhZGRyZXNzIChhdXRvLXJlZ2lzdGVyZWQgYXMgUHJvdG9jb2wgMCkAAAAACmluaXRpYWxpemUAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAARYXN0cm9zd2FwX2ZhY3RvcnkAAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAB9VcGRhdGUgYWdncmVnYXRvciBjb25maWd1cmF0aW9uAAAAAApzZXRfY29uZmlnAAAAAAAEAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACG1heF9ob3BzAAAABAAAAAAAAAAKbWF4X3NwbGl0cwAAAAAABAAAAAAAAAASYWdncmVnYXRvcl9mZWVfYnBzAAAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAB9QYXVzZSBvciB1bnBhdXNlIHRoZSBhZ2dyZWdhdG9yAAAAAApzZXRfcGF1c2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABnBhdXNlZAAAAAAAAQAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABFHZXQgZmVlIHJlY2lwaWVudAAAAAAAAA1mZWVfcmVjaXBpZW50AAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAG1HZXQgcXVvdGVzIGZyb20gYWxsIHJlZ2lzdGVyZWQgcHJvdG9jb2xzIGZvciBhIHN3YXAKClJldHVybnMgYSB2ZWN0b3Igb2YgKHByb3RvY29sX2lkLCBleHBlY3RlZF9vdXRwdXQpIHBhaXJzAAAAAAAADmdldF9hbGxfcXVvdGVzAAAAAAADAAAAAAAAAAh0b2tlbl9pbgAAABMAAAAAAAAACXRva2VuX291dAAAAAAAABMAAAAAAAAACWFtb3VudF9pbgAAAAAAAAsAAAABAAAD6gAAA+0AAAACAAAABAAAAAs=",
        "AAAAAAAAACJHZXQgbnVtYmVyIG9mIHJlZ2lzdGVyZWQgcHJvdG9jb2xzAAAAAAAOcHJvdG9jb2xfY291bnQAAAAAAAAAAAABAAAABA==",
        "AAAAAAAAAOtGaW5kIHRoZSBiZXN0IHN3YXAgcm91dGUgYWNyb3NzIGFsbCByZWdpc3RlcmVkIHByb3RvY29scwoKIyBBcmd1bWVudHMKKiBgdG9rZW5faW5gIC0gSW5wdXQgdG9rZW4gYWRkcmVzcwoqIGB0b2tlbl9vdXRgIC0gT3V0cHV0IHRva2VuIGFkZHJlc3MKKiBgYW1vdW50X2luYCAtIEFtb3VudCBvZiBpbnB1dCB0b2tlbnMKCiMgUmV0dXJucwoqIEJlc3QgU3dhcFJvdXRlIGZvdW5kIGFjcm9zcyBhbGwgcHJvdG9jb2xzAAAAAA9maW5kX2Jlc3Rfcm91dGUAAAAAAwAAAAAAAAAIdG9rZW5faW4AAAATAAAAAAAAAAl0b2tlbl9vdXQAAAAAAAATAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAQAAA+kAAAfQAAAACVN3YXBSb3V0ZQAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAH9FeGVjdXRlIGEgc3dhcCB1c2luZyBhIHByZS1jb21wdXRlZCByb3V0ZQoKVXNlZnVsIHdoZW4gdGhlIHVzZXIgYWxyZWFkeSBrbm93cyB0aGUgb3B0aW1hbCByb3V0ZQpvciB3YW50cyB0byB1c2UgYSBzcGVjaWZpYyBwYXRoAAAAAA9zd2FwX3dpdGhfcm91dGUAAAAABQAAAAAAAAAEdXNlcgAAABMAAAAAAAAABXJvdXRlAAAAAAAH0AAAAAlTd2FwUm91dGUAAAAAAAAAAAAACWFtb3VudF9pbgAAAAAAAAsAAAAAAAAAB21pbl9vdXQAAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAQAAA+kAAAALAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABlHZXQgcHJvdG9jb2wgYWRhcHRlciBpbmZvAAAAAAAAEWdldF9wcm90b2NvbF9pbmZvAAAAAAAAAQAAAAAAAAAIcHJvdG9jb2wAAAfQAAAACFByb3RvY29sAAAAAQAAA+gAAAfQAAAAD1Byb3RvY29sQWRhcHRlcgA=",
        "AAAAAAAAAOZSZWdpc3RlciBhIG5ldyBwcm90b2NvbCBhZGFwdGVyCgojIEFyZ3VtZW50cwoqIGBhZG1pbmAgLSBNdXN0IGJlIGNvbnRyYWN0IGFkbWluCiogYHByb3RvY29sYCAtIFByb3RvY29sIGVudW0gdmFyaWFudAoqIGBmYWN0b3J5X2FkZHJlc3NgIC0gRmFjdG9yeSBvciByb3V0ZXIgYWRkcmVzcyBmb3IgdGhlIHByb3RvY29sCiogYGRlZmF1bHRfZmVlX2Jwc2AgLSBEZWZhdWx0IGZlZSBmb3IgZXN0aW1hdGlvbgAAAAAAEXJlZ2lzdGVyX3Byb3RvY29sAAAAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAIUHJvdG9jb2wAAAAAAAAAD2ZhY3RvcnlfYWRkcmVzcwAAAAATAAAAAAAAAA9kZWZhdWx0X2ZlZV9icHMAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAACVTZXQgZmVlIHJlY2lwaWVudCBmb3IgYWdncmVnYXRvciBmZWVzAAAAAAAAEXNldF9mZWVfcmVjaXBpZW50AAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAACJHZXQgcXVvdGUgZnJvbSBhIHNwZWNpZmljIHByb3RvY29sAAAAAAASZ2V0X3Byb3RvY29sX3F1b3RlAAAAAAAEAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAIUHJvdG9jb2wAAAAAAAAACHRva2VuX2luAAAAEwAAAAAAAAAJdG9rZW5fb3V0AAAAAAAAEwAAAAAAAAAJYW1vdW50X2luAAAAAAAACwAAAAEAAAPpAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABxFbmFibGUgb3IgZGlzYWJsZSBhIHByb3RvY29sAAAAE3NldF9wcm90b2NvbF9hY3RpdmUAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAIUHJvdG9jb2wAAAAAAAAACWlzX2FjdGl2ZQAAAAAAAAEAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAgAAAChTdG9yYWdlIGtleXMgZm9yIHRoZSBhZ2dyZWdhdG9yIGNvbnRyYWN0AAAAAAAAAAdEYXRhS2V5AAAAAAcAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAAC0luaXRpYWxpemVkAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAGQ29uZmlnAAAAAAAAAAAAAAAAAA1Qcm90b2NvbENvdW50AAAAAAAAAQAAAAAAAAAIUHJvdG9jb2wAAAABAAAABAAAAAAAAAAAAAAADEZlZVJlY2lwaWVudA==",
        "AAAAAQAAABxQcm90b2NvbCBhZGFwdGVyIGluZm9ybWF0aW9uAAAAAAAAAA9Qcm90b2NvbEFkYXB0ZXIAAAAABAAAACxEZWZhdWx0IGZlZSBpbiBiYXNpcyBwb2ludHMgKGZvciBlc3RpbWF0aW9uKQAAAA9kZWZhdWx0X2ZlZV9icHMAAAAABAAAACtGYWN0b3J5IG9yIHJvdXRlciBhZGRyZXNzIGZvciB0aGlzIHByb3RvY29sAAAAAA9mYWN0b3J5X2FkZHJlc3MAAAAAEwAAAB9XaGV0aGVyIHRoaXMgcHJvdG9jb2wgaXMgYWN0aXZlAAAAAAlpc19hY3RpdmUAAAAAAAABAAAAI1Byb3RvY29sIElEIChtYXRjaGVzIFByb3RvY29sIGVudW0pAAAAAAtwcm90b2NvbF9pZAAAAAAE",
        "AAAAAQAAABhBZ2dyZWdhdG9yIGNvbmZpZ3VyYXRpb24AAAAAAAAAEEFnZ3JlZ2F0b3JDb25maWcAAAADAAAAKUZlZSBjaGFyZ2VkIGJ5IGFnZ3JlZ2F0b3IgaW4gYmFzaXMgcG9pbnRzAAAAAAAAEmFnZ3JlZ2F0b3JfZmVlX2JwcwAAAAAABAAAACFNYXhpbXVtIG51bWJlciBvZiBob3BzIGluIGEgcm91dGUAAAAAAAAIbWF4X2hvcHMAAAAEAAAAJU1heGltdW0gc3BsaXQgcGF0aHMgZm9yIGEgc2luZ2xlIHN3YXAAAAAAAAAKbWF4X3NwbGl0cwAAAAAABA==",
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
    swap: this.txFromJSON<Result<i128>>,
        admin: this.txFromJSON<string>,
        config: this.txFromJSON<AggregatorConfig>,
        is_paused: this.txFromJSON<boolean>,
        set_admin: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        set_config: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        fee_recipient: this.txFromJSON<Option<string>>,
        get_all_quotes: this.txFromJSON<Array<readonly [u32, i128]>>,
        protocol_count: this.txFromJSON<u32>,
        find_best_route: this.txFromJSON<Result<SwapRoute>>,
        swap_with_route: this.txFromJSON<Result<i128>>,
        get_protocol_info: this.txFromJSON<Option<ProtocolAdapter>>,
        register_protocol: this.txFromJSON<Result<void>>,
        set_fee_recipient: this.txFromJSON<Result<void>>,
        get_protocol_quote: this.txFromJSON<Result<i128>>,
        set_protocol_active: this.txFromJSON<Result<void>>
  }
}