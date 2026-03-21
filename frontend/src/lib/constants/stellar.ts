import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Dummy account for Soroban contract simulations
 * This is a valid Stellar address format used only for contract calls that don't modify state
 *
 * IMPORTANT: This address is ONLY for simulation purposes (estimating gas, reading state, etc)
 * It should NEVER be used for actual transactions or to hold funds
 */
export const DUMMY_SIMULATION_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/**
 * Helper function to create a dummy account for simulations
 * Eliminates code duplication across the codebase
 *
 * @returns StellarSdk.Account with sequence number '0' for simulation
 */
export function createDummyAccount(): StellarSdk.Account {
  return new StellarSdk.Account(DUMMY_SIMULATION_ADDRESS, '0');
}
