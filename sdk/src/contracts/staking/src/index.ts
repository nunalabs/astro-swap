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
 * Storage keys for the staking contract
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "Initialized", values: void} | {tag: "Paused", values: void} | {tag: "PoolCount", values: void} | {tag: "RewardToken", values: void} | {tag: "Pool", values: readonly [u32]} | {tag: "UserStake", values: readonly [string, u32]} | {tag: "UserRewardDebt", values: readonly [string, u32]};

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
   * Construct and simulate a stake transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Stake LP tokens in a pool
   * 
   * # Arguments
   * * `user` - User address
   * * `pool_id` - Pool to stake in
   * * `amount` - Amount of LP tokens to stake
   */
  stake: ({user, pool_id, amount}: {user: string, pool_id: u32, amount: i128}, options?: {
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
   * Construct and simulate a unstake transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unstake LP tokens from a pool
   * 
   * # Arguments
   * * `user` - User address
   * * `pool_id` - Pool to unstake from
   * * `amount` - Amount of LP tokens to unstake
   */
  unstake: ({user, pool_id, amount}: {user: string, pool_id: u32, amount: i128}, options?: {
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
   * Construct and simulate a compound transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Compound rewards back into stake (if reward token == LP token)
   */
  compound: ({user, pool_id}: {user: string, pool_id: u32}, options?: {
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
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if contract is paused
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
   * Construct and simulate a pool_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pool information
   */
  pool_info: ({pool_id}: {pool_id: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Result<StakingPool>>>

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
   * Construct and simulate a user_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get user stake information
   */
  user_info: ({user, pool_id}: {user: string, pool_id: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Result<UserStake>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the staking contract
   */
  initialize: ({admin, reward_token}: {admin: string, reward_token: string}, options?: {
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
   * Construct and simulate a pool_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pool count
   */
  pool_count: (options?: {
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
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause/unpause the contract
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
   * Construct and simulate a create_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new staking pool
   * 
   * # Arguments
   * * `admin` - Admin address (must match contract admin)
   * * `lp_token` - LP token address to stake
   * * `reward_per_second` - Rewards distributed per second
   * * `start_time` - When rewards start accruing
   * * `end_time` - When rewards stop accruing
   */
  create_pool: ({admin, lp_token, reward_per_second, start_time, end_time}: {admin: string, lp_token: string, reward_per_second: i128, start_time: u64, end_time: u64}, options?: {
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
  }) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a fund_rewards transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fund the reward pool
   */
  fund_rewards: ({funder, amount}: {funder: string, amount: i128}, options?: {
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
   * Construct and simulate a reward_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get reward token address
   */
  reward_token: (options?: {
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
   * Construct and simulate a claim_rewards transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claim pending rewards without unstaking
   */
  claim_rewards: ({user, pool_id}: {user: string, pool_id: u32}, options?: {
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
   * Construct and simulate a get_multiplier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current multiplier for a user
   */
  get_multiplier: ({user, pool_id}: {user: string, pool_id: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a pending_rewards transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pending rewards for a user
   */
  pending_rewards: ({user, pool_id}: {user: string, pool_id: u32}, options?: {
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
   * Construct and simulate a update_pool_rewards transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update pool reward rate
   */
  update_pool_rewards: ({admin, pool_id, reward_per_second}: {admin: string, pool_id: u32, reward_per_second: i128}, options?: {
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
      new ContractSpec([ "AAAAAgAAACVTdG9yYWdlIGtleXMgZm9yIHRoZSBzdGFraW5nIGNvbnRyYWN0AAAAAAAAAAAAAAdEYXRhS2V5AAAAAAgAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAAC0luaXRpYWxpemVkAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAJUG9vbENvdW50AAAAAAAAAAAAAAAAAAALUmV3YXJkVG9rZW4AAAAAAQAAAAAAAAAEUG9vbAAAAAEAAAAEAAAAAQAAAAAAAAAJVXNlclN0YWtlAAAAAAAAAgAAABMAAAAEAAAAAQAAAAAAAAAOVXNlclJld2FyZERlYnQAAAAAAAIAAAATAAAABA==",
        "AAAAAAAAABFHZXQgYWRtaW4gYWRkcmVzcwAAAAAAAAVhZG1pbgAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAIdTdGFrZSBMUCB0b2tlbnMgaW4gYSBwb29sCgojIEFyZ3VtZW50cwoqIGB1c2VyYCAtIFVzZXIgYWRkcmVzcwoqIGBwb29sX2lkYCAtIFBvb2wgdG8gc3Rha2UgaW4KKiBgYW1vdW50YCAtIEFtb3VudCBvZiBMUCB0b2tlbnMgdG8gc3Rha2UAAAAABXN0YWtlAAAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAAB3Bvb2xfaWQAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAJFVbnN0YWtlIExQIHRva2VucyBmcm9tIGEgcG9vbAoKIyBBcmd1bWVudHMKKiBgdXNlcmAgLSBVc2VyIGFkZHJlc3MKKiBgcG9vbF9pZGAgLSBQb29sIHRvIHVuc3Rha2UgZnJvbQoqIGBhbW91bnRgIC0gQW1vdW50IG9mIExQIHRva2VucyB0byB1bnN0YWtlAAAAAAAAB3Vuc3Rha2UAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAAB3Bvb2xfaWQAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAD5Db21wb3VuZCByZXdhcmRzIGJhY2sgaW50byBzdGFrZSAoaWYgcmV3YXJkIHRva2VuID09IExQIHRva2VuKQAAAAAACGNvbXBvdW5kAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAAB3Bvb2xfaWQAAAAABAAAAAEAAAPpAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABtDaGVjayBpZiBjb250cmFjdCBpcyBwYXVzZWQAAAAACWlzX3BhdXNlZAAAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAABRHZXQgcG9vbCBpbmZvcm1hdGlvbgAAAAlwb29sX2luZm8AAAAAAAABAAAAAAAAAAdwb29sX2lkAAAAAAQAAAABAAAD6QAAB9AAAAALU3Rha2luZ1Bvb2wAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABNUcmFuc2ZlciBhZG1pbiByb2xlAAAAAAlzZXRfYWRtaW4AAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABpHZXQgdXNlciBzdGFrZSBpbmZvcm1hdGlvbgAAAAAACXVzZXJfaW5mbwAAAAAAAAIAAAAAAAAABHVzZXIAAAATAAAAAAAAAAdwb29sX2lkAAAAAAQAAAABAAAD6QAAB9AAAAAJVXNlclN0YWtlAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAB9Jbml0aWFsaXplIHRoZSBzdGFraW5nIGNvbnRyYWN0AAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAADHJld2FyZF90b2tlbgAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAA5HZXQgcG9vbCBjb3VudAAAAAAACnBvb2xfY291bnQAAAAAAAAAAAABAAAABA==",
        "AAAAAAAAABpQYXVzZS91bnBhdXNlIHRoZSBjb250cmFjdAAAAAAACnNldF9wYXVzZWQAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAARNDcmVhdGUgYSBuZXcgc3Rha2luZyBwb29sCgojIEFyZ3VtZW50cwoqIGBhZG1pbmAgLSBBZG1pbiBhZGRyZXNzIChtdXN0IG1hdGNoIGNvbnRyYWN0IGFkbWluKQoqIGBscF90b2tlbmAgLSBMUCB0b2tlbiBhZGRyZXNzIHRvIHN0YWtlCiogYHJld2FyZF9wZXJfc2Vjb25kYCAtIFJld2FyZHMgZGlzdHJpYnV0ZWQgcGVyIHNlY29uZAoqIGBzdGFydF90aW1lYCAtIFdoZW4gcmV3YXJkcyBzdGFydCBhY2NydWluZwoqIGBlbmRfdGltZWAgLSBXaGVuIHJld2FyZHMgc3RvcCBhY2NydWluZwAAAAALY3JlYXRlX3Bvb2wAAAAABQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhscF90b2tlbgAAABMAAAAAAAAAEXJld2FyZF9wZXJfc2Vjb25kAAAAAAAACwAAAAAAAAAKc3RhcnRfdGltZQAAAAAABgAAAAAAAAAIZW5kX3RpbWUAAAAGAAAAAQAAA+kAAAAEAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABRGdW5kIHRoZSByZXdhcmQgcG9vbAAAAAxmdW5kX3Jld2FyZHMAAAACAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABhHZXQgcmV3YXJkIHRva2VuIGFkZHJlc3MAAAAMcmV3YXJkX3Rva2VuAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAACdDbGFpbSBwZW5kaW5nIHJld2FyZHMgd2l0aG91dCB1bnN0YWtpbmcAAAAADWNsYWltX3Jld2FyZHMAAAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAEAAAAAQAAA+kAAAALAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAACFHZXQgY3VycmVudCBtdWx0aXBsaWVyIGZvciBhIHVzZXIAAAAAAAAOZ2V0X211bHRpcGxpZXIAAAAAAAIAAAAAAAAABHVzZXIAAAATAAAAAAAAAAdwb29sX2lkAAAAAAQAAAABAAAD6QAAAAQAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAAB5HZXQgcGVuZGluZyByZXdhcmRzIGZvciBhIHVzZXIAAAAAAA9wZW5kaW5nX3Jld2FyZHMAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAAB3Bvb2xfaWQAAAAABAAAAAEAAAPpAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABdVcGRhdGUgcG9vbCByZXdhcmQgcmF0ZQAAAAATdXBkYXRlX3Bvb2xfcmV3YXJkcwAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAB3Bvb2xfaWQAAAAABAAAAAAAAAARcmV3YXJkX3Blcl9zZWNvbmQAAAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
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
        stake: this.txFromJSON<Result<void>>,
        unstake: this.txFromJSON<Result<void>>,
        compound: this.txFromJSON<Result<i128>>,
        is_paused: this.txFromJSON<boolean>,
        pool_info: this.txFromJSON<Result<StakingPool>>,
        set_admin: this.txFromJSON<Result<void>>,
        user_info: this.txFromJSON<Result<UserStake>>,
        initialize: this.txFromJSON<Result<void>>,
        pool_count: this.txFromJSON<u32>,
        set_paused: this.txFromJSON<Result<void>>,
        create_pool: this.txFromJSON<Result<u32>>,
        fund_rewards: this.txFromJSON<Result<void>>,
        reward_token: this.txFromJSON<Option<string>>,
        claim_rewards: this.txFromJSON<Result<i128>>,
        get_multiplier: this.txFromJSON<Result<u32>>,
        pending_rewards: this.txFromJSON<Result<i128>>,
        update_pool_rewards: this.txFromJSON<Result<void>>
  }
}