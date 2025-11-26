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
 * Storage keys for the pair contract
 */
export type DataKey = {tag: "Factory", values: void} | {tag: "Token0", values: void} | {tag: "Token1", values: void} | {tag: "Reserve0", values: void} | {tag: "Reserve1", values: void} | {tag: "TotalSupply", values: void} | {tag: "KLast", values: void} | {tag: "FeeBps", values: void} | {tag: "Initialized", values: void} | {tag: "Locked", values: void} | {tag: "Balance", values: readonly [string]} | {tag: "Allowance", values: readonly [string, string]};

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
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Burn LP tokens (only callable by token owner)
   */
  burn: ({from, amount}: {from: string, amount: i128}, options?: {
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
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get LP token name
   */
  name: (options?: {
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
   * Construct and simulate a skim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer excess tokens to a recipient
   * SECURITY: Only callable by factory contract to prevent exploitation
   * This function transfers the difference between actual balance and reserves
   */
  skim: ({to}: {to: string}, options?: {
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
   * Construct and simulate a swap transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute a swap
   * 
   * # Arguments
   * * `user` - The address executing the swap
   * * `token_in` - Address of the token being swapped in
   * * `amount_in` - Amount of token_in to swap
   * * `min_out` - Minimum amount of output token (slippage protection)
   * 
   * # Returns
   * * Amount of output token received
   */
  swap: ({user, token_in, amount_in, min_out}: {user: string, token_in: string, amount_in: i128, min_out: i128}, options?: {
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
   * Construct and simulate a sync transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Force reserves to match actual token balances
   * Can be called by anyone to recover from edge cases
   */
  sync: (options?: {
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
   * Construct and simulate a k_last transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get k_last (product of reserves at last interaction)
   */
  k_last: (options?: {
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
  }) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get LP token symbol
   */
  symbol: (options?: {
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
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve spender
   */
  approve: ({owner, spender, amount}: {owner: string, spender: string, amount: i128}, options?: {
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
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get LP token balance
   */
  balance: ({owner}: {owner: string}, options?: {
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
  }) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit liquidity and receive LP tokens
   * 
   * # Arguments
   * * `user` - The address depositing liquidity
   * * `amount_0_desired` - Desired amount of token_0 to deposit
   * * `amount_1_desired` - Desired amount of token_1 to deposit
   * * `amount_0_min` - Minimum amount of token_0 (slippage protection)
   * * `amount_1_min` - Minimum amount of token_1 (slippage protection)
   * 
   * # Returns
   * * Tuple of (amount_0_used, amount_1_used, shares_minted)
   */
  deposit: ({user, amount_0_desired, amount_1_desired, amount_0_min, amount_1_min}: {user: string, amount_0_desired: i128, amount_1_desired: i128, amount_0_min: i128, amount_1_min: i128}, options?: {
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
   * Construct and simulate a fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get fee in basis points
   */
  fee_bps: (options?: {
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
   * Construct and simulate a token_0 transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get token 0 address
   */
  token_0: (options?: {
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
   * Construct and simulate a token_1 transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get token 1 address
   */
  token_1: (options?: {
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
   * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get LP token decimals
   */
  decimals: (options?: {
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
   * Construct and simulate a get_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pair information
   */
  get_info: (options?: {
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
  }) => Promise<AssembledTransaction<PairInfo>>

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer LP tokens
   */
  transfer: ({from, to, amount}: {from: string, to: string, amount: i128}, options?: {
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
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw liquidity by burning LP tokens
   * 
   * # Arguments
   * * `user` - The address withdrawing liquidity
   * * `shares` - Amount of LP tokens to burn
   * * `amount_0_min` - Minimum amount of token_0 to receive
   * * `amount_1_min` - Minimum amount of token_1 to receive
   * 
   * # Returns
   * * Tuple of (amount_0_received, amount_1_received)
   */
  withdraw: ({user, shares, amount_0_min, amount_1_min}: {user: string, shares: i128, amount_0_min: i128, amount_1_min: i128}, options?: {
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
   * Construct and simulate a allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get allowance
   */
  allowance: ({owner, spender}: {owner: string, spender: string}, options?: {
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
  }) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the pair contract
   * Called by the factory after deployment
   */
  initialize: ({factory, token_0, token_1}: {factory: string, token_0: string, token_1: string}, options?: {
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
   * Construct and simulate a get_reserves transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get reserves
   */
  get_reserves: (options?: {
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
  }) => Promise<AssembledTransaction<readonly [i128, i128]>>

  /**
   * Construct and simulate a total_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total supply of LP tokens
   */
  total_supply: (options?: {
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
  }) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_amount_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get required input amount for a specific output
   */
  get_amount_in: ({amount_out, token_out}: {amount_out: i128, token_out: string}, options?: {
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
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer LP tokens using allowance
   */
  transfer_from: ({spender, from, to, amount}: {spender: string, from: string, to: string, amount: i128}, options?: {
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
   * Construct and simulate a get_amount_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get expected output amount for a swap
   */
  get_amount_out: ({amount_in, token_in}: {amount_in: i128, token_in: string}, options?: {
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
   * Construct and simulate a swap_from_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Low-level swap for router (tokens already in contract)
   * Used by router for multi-hop swaps where tokens are pre-transferred
   * 
   * # Arguments
   * * `to` - Recipient of output tokens (next pair or final user)
   * * `token_in` - Address of the input token
   * * `min_out` - Minimum output amount (slippage protection)
   * 
   * # Returns
   * * (amount_in, amount_out) - Actual amounts swapped
   */
  swap_from_balance: ({to, token_in, min_out}: {to: string, token_in: string, min_out: i128}, options?: {
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
      new ContractSpec([ "AAAAAgAAACJTdG9yYWdlIGtleXMgZm9yIHRoZSBwYWlyIGNvbnRyYWN0AAAAAAAAAAAAB0RhdGFLZXkAAAAADAAAAAAAAAAAAAAAB0ZhY3RvcnkAAAAAAAAAAAAAAAAGVG9rZW4wAAAAAAAAAAAAAAAAAAZUb2tlbjEAAAAAAAAAAAAAAAAACFJlc2VydmUwAAAAAAAAAAAAAAAIUmVzZXJ2ZTEAAAAAAAAAAAAAAAtUb3RhbFN1cHBseQAAAAAAAAAAAAAAAAVLTGFzdAAAAAAAAAAAAAAAAAAABkZlZUJwcwAAAAAAAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAAGTG9ja2VkAAAAAAABAAAAAAAAAAdCYWxhbmNlAAAAAAEAAAATAAAAAQAAAAAAAAAJQWxsb3dhbmNlAAAAAAAAAgAAABMAAAAT",
        "AAAAAAAAAC1CdXJuIExQIHRva2VucyAob25seSBjYWxsYWJsZSBieSB0b2tlbiBvd25lcikAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAABFHZXQgTFAgdG9rZW4gbmFtZQAAAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAALRUcmFuc2ZlciBleGNlc3MgdG9rZW5zIHRvIGEgcmVjaXBpZW50ClNFQ1VSSVRZOiBPbmx5IGNhbGxhYmxlIGJ5IGZhY3RvcnkgY29udHJhY3QgdG8gcHJldmVudCBleHBsb2l0YXRpb24KVGhpcyBmdW5jdGlvbiB0cmFuc2ZlcnMgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBhY3R1YWwgYmFsYW5jZSBhbmQgcmVzZXJ2ZXMAAAAEc2tpbQAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAARVFeGVjdXRlIGEgc3dhcAoKIyBBcmd1bWVudHMKKiBgdXNlcmAgLSBUaGUgYWRkcmVzcyBleGVjdXRpbmcgdGhlIHN3YXAKKiBgdG9rZW5faW5gIC0gQWRkcmVzcyBvZiB0aGUgdG9rZW4gYmVpbmcgc3dhcHBlZCBpbgoqIGBhbW91bnRfaW5gIC0gQW1vdW50IG9mIHRva2VuX2luIHRvIHN3YXAKKiBgbWluX291dGAgLSBNaW5pbXVtIGFtb3VudCBvZiBvdXRwdXQgdG9rZW4gKHNsaXBwYWdlIHByb3RlY3Rpb24pCgojIFJldHVybnMKKiBBbW91bnQgb2Ygb3V0cHV0IHRva2VuIHJlY2VpdmVkAAAAAAAABHN3YXAAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAIdG9rZW5faW4AAAATAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAdtaW5fb3V0AAAAAAsAAAABAAAD6QAAAAsAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAAGBGb3JjZSByZXNlcnZlcyB0byBtYXRjaCBhY3R1YWwgdG9rZW4gYmFsYW5jZXMKQ2FuIGJlIGNhbGxlZCBieSBhbnlvbmUgdG8gcmVjb3ZlciBmcm9tIGVkZ2UgY2FzZXMAAAAEc3luYwAAAAAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAADRHZXQga19sYXN0IChwcm9kdWN0IG9mIHJlc2VydmVzIGF0IGxhc3QgaW50ZXJhY3Rpb24pAAAABmtfbGFzdAAAAAAAAAAAAAEAAAAL",
        "AAAAAAAAABNHZXQgTFAgdG9rZW4gc3ltYm9sAAAAAAZzeW1ib2wAAAAAAAAAAAABAAAAEA==",
        "AAAAAAAAAA9BcHByb3ZlIHNwZW5kZXIAAAAAB2FwcHJvdmUAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAABRHZXQgTFAgdG9rZW4gYmFsYW5jZQAAAAdiYWxhbmNlAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAaJEZXBvc2l0IGxpcXVpZGl0eSBhbmQgcmVjZWl2ZSBMUCB0b2tlbnMKCiMgQXJndW1lbnRzCiogYHVzZXJgIC0gVGhlIGFkZHJlc3MgZGVwb3NpdGluZyBsaXF1aWRpdHkKKiBgYW1vdW50XzBfZGVzaXJlZGAgLSBEZXNpcmVkIGFtb3VudCBvZiB0b2tlbl8wIHRvIGRlcG9zaXQKKiBgYW1vdW50XzFfZGVzaXJlZGAgLSBEZXNpcmVkIGFtb3VudCBvZiB0b2tlbl8xIHRvIGRlcG9zaXQKKiBgYW1vdW50XzBfbWluYCAtIE1pbmltdW0gYW1vdW50IG9mIHRva2VuXzAgKHNsaXBwYWdlIHByb3RlY3Rpb24pCiogYGFtb3VudF8xX21pbmAgLSBNaW5pbXVtIGFtb3VudCBvZiB0b2tlbl8xIChzbGlwcGFnZSBwcm90ZWN0aW9uKQoKIyBSZXR1cm5zCiogVHVwbGUgb2YgKGFtb3VudF8wX3VzZWQsIGFtb3VudF8xX3VzZWQsIHNoYXJlc19taW50ZWQpAAAAAAAHZGVwb3NpdAAAAAAFAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAQYW1vdW50XzBfZGVzaXJlZAAAAAsAAAAAAAAAEGFtb3VudF8xX2Rlc2lyZWQAAAALAAAAAAAAAAxhbW91bnRfMF9taW4AAAALAAAAAAAAAAxhbW91bnRfMV9taW4AAAALAAAAAQAAA+kAAAPtAAAAAwAAAAsAAAALAAAACwAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAABNHZXQgZmFjdG9yeSBhZGRyZXNzAAAAAAdmYWN0b3J5AAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABdHZXQgZmVlIGluIGJhc2lzIHBvaW50cwAAAAAHZmVlX2JwcwAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAABNHZXQgdG9rZW4gMCBhZGRyZXNzAAAAAAd0b2tlbl8wAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABNHZXQgdG9rZW4gMSBhZGRyZXNzAAAAAAd0b2tlbl8xAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAABVHZXQgTFAgdG9rZW4gZGVjaW1hbHMAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAABRHZXQgcGFpciBpbmZvcm1hdGlvbgAAAAhnZXRfaW5mbwAAAAAAAAABAAAH0AAAAAhQYWlySW5mbw==",
        "AAAAAAAAABJUcmFuc2ZlciBMUCB0b2tlbnMAAAAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAATdXaXRoZHJhdyBsaXF1aWRpdHkgYnkgYnVybmluZyBMUCB0b2tlbnMKCiMgQXJndW1lbnRzCiogYHVzZXJgIC0gVGhlIGFkZHJlc3Mgd2l0aGRyYXdpbmcgbGlxdWlkaXR5CiogYHNoYXJlc2AgLSBBbW91bnQgb2YgTFAgdG9rZW5zIHRvIGJ1cm4KKiBgYW1vdW50XzBfbWluYCAtIE1pbmltdW0gYW1vdW50IG9mIHRva2VuXzAgdG8gcmVjZWl2ZQoqIGBhbW91bnRfMV9taW5gIC0gTWluaW11bSBhbW91bnQgb2YgdG9rZW5fMSB0byByZWNlaXZlCgojIFJldHVybnMKKiBUdXBsZSBvZiAoYW1vdW50XzBfcmVjZWl2ZWQsIGFtb3VudF8xX3JlY2VpdmVkKQAAAAAId2l0aGRyYXcAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAAAAAAxhbW91bnRfMF9taW4AAAALAAAAAAAAAAxhbW91bnRfMV9taW4AAAALAAAAAQAAA+kAAAPtAAAAAgAAAAsAAAALAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAAA1HZXQgYWxsb3dhbmNlAAAAAAAACWFsbG93YW5jZQAAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAENJbml0aWFsaXplIHRoZSBwYWlyIGNvbnRyYWN0CkNhbGxlZCBieSB0aGUgZmFjdG9yeSBhZnRlciBkZXBsb3ltZW50AAAAAAppbml0aWFsaXplAAAAAAADAAAAAAAAAAdmYWN0b3J5AAAAABMAAAAAAAAAB3Rva2VuXzAAAAAAEwAAAAAAAAAHdG9rZW5fMQAAAAATAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAOQXN0cm9Td2FwRXJyb3IAAA==",
        "AAAAAAAAAAxHZXQgcmVzZXJ2ZXMAAAAMZ2V0X3Jlc2VydmVzAAAAAAAAAAEAAAPtAAAAAgAAAAsAAAAL",
        "AAAAAAAAAB1HZXQgdG90YWwgc3VwcGx5IG9mIExQIHRva2VucwAAAAAAAAx0b3RhbF9zdXBwbHkAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAC9HZXQgcmVxdWlyZWQgaW5wdXQgYW1vdW50IGZvciBhIHNwZWNpZmljIG91dHB1dAAAAAANZ2V0X2Ftb3VudF9pbgAAAAAAAAIAAAAAAAAACmFtb3VudF9vdXQAAAAAAAsAAAAAAAAACXRva2VuX291dAAAAAAAABMAAAABAAAD6QAAAAsAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAACJUcmFuc2ZlciBMUCB0b2tlbnMgdXNpbmcgYWxsb3dhbmNlAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA5Bc3Ryb1N3YXBFcnJvcgAA",
        "AAAAAAAAACVHZXQgZXhwZWN0ZWQgb3V0cHV0IGFtb3VudCBmb3IgYSBzd2FwAAAAAAAADmdldF9hbW91bnRfb3V0AAAAAAACAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAh0b2tlbl9pbgAAABMAAAABAAAD6QAAAAsAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
        "AAAAAAAAAWdMb3ctbGV2ZWwgc3dhcCBmb3Igcm91dGVyICh0b2tlbnMgYWxyZWFkeSBpbiBjb250cmFjdCkKVXNlZCBieSByb3V0ZXIgZm9yIG11bHRpLWhvcCBzd2FwcyB3aGVyZSB0b2tlbnMgYXJlIHByZS10cmFuc2ZlcnJlZAoKIyBBcmd1bWVudHMKKiBgdG9gIC0gUmVjaXBpZW50IG9mIG91dHB1dCB0b2tlbnMgKG5leHQgcGFpciBvciBmaW5hbCB1c2VyKQoqIGB0b2tlbl9pbmAgLSBBZGRyZXNzIG9mIHRoZSBpbnB1dCB0b2tlbgoqIGBtaW5fb3V0YCAtIE1pbmltdW0gb3V0cHV0IGFtb3VudCAoc2xpcHBhZ2UgcHJvdGVjdGlvbikKCiMgUmV0dXJucwoqIChhbW91bnRfaW4sIGFtb3VudF9vdXQpIC0gQWN0dWFsIGFtb3VudHMgc3dhcHBlZAAAAAARc3dhcF9mcm9tX2JhbGFuY2UAAAAAAAADAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAIdG9rZW5faW4AAAATAAAAAAAAAAdtaW5fb3V0AAAAAAsAAAABAAAD6QAAA+0AAAACAAAACwAAAAsAAAfQAAAADkFzdHJvU3dhcEVycm9yAAA=",
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
    burn: this.txFromJSON<Result<void>>,
        name: this.txFromJSON<string>,
        skim: this.txFromJSON<Result<void>>,
        swap: this.txFromJSON<Result<i128>>,
        sync: this.txFromJSON<Result<void>>,
        k_last: this.txFromJSON<i128>,
        symbol: this.txFromJSON<string>,
        approve: this.txFromJSON<Result<void>>,
        balance: this.txFromJSON<i128>,
        deposit: this.txFromJSON<Result<readonly [i128, i128, i128]>>,
        factory: this.txFromJSON<string>,
        fee_bps: this.txFromJSON<u32>,
        token_0: this.txFromJSON<string>,
        token_1: this.txFromJSON<string>,
        decimals: this.txFromJSON<u32>,
        get_info: this.txFromJSON<PairInfo>,
        transfer: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<readonly [i128, i128]>>,
        allowance: this.txFromJSON<i128>,
        initialize: this.txFromJSON<Result<void>>,
        get_reserves: this.txFromJSON<readonly [i128, i128]>,
        total_supply: this.txFromJSON<i128>,
        get_amount_in: this.txFromJSON<Result<i128>>,
        transfer_from: this.txFromJSON<Result<void>>,
        get_amount_out: this.txFromJSON<Result<i128>>,
        swap_from_balance: this.txFromJSON<Result<readonly [i128, i128]>>
  }
}