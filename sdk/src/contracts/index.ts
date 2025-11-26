/**
 * Contract Clients Export
 *
 * High-level wrapper clients (custom implementation)
 */

export { BaseContractClient } from './base';
export type { ContractClientConfig } from './base';

export { FactoryClient } from './factory';
export { PairClient } from './pair';
export { RouterClient } from './router';
export type { RouterClientConfig } from './router';
export { StakingClient } from './staking';
export { AggregatorClient } from './aggregator';
export { BridgeClient } from './bridge';

/**
 * Generated Bindings (Stellar SDK Contract Client)
 *
 * Auto-generated from contract WASM files using stellar contract bindings typescript
 * These provide type-safe, auto-generated clients for direct contract interaction
 */
export * as FactoryBinding from './factory/dist/index';
export * as PairBinding from './pair/dist/index';
export * as RouterBinding from './router/dist/index';
export * as StakingBinding from './staking/dist/index';
export * as AggregatorBinding from './aggregator/dist/index';
export * as BridgeBinding from './bridge/dist/index';
