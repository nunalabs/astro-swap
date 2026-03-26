/**
 * Contract Configuration
 * Addresses and validation for all deployed contracts
 */

import { isValidContractId } from '../utils';

// Contract addresses (set via environment variables)
export const CONTRACTS = {
  FACTORY: import.meta.env.VITE_FACTORY_CONTRACT_ID || '',
  ROUTER: import.meta.env.VITE_ROUTER_CONTRACT_ID || '',
  STAKING: import.meta.env.VITE_STAKING_CONTRACT_ID || '',
  AGGREGATOR: import.meta.env.VITE_AGGREGATOR_CONTRACT_ID || '',
  BRIDGE: import.meta.env.VITE_BRIDGE_CONTRACT_ID || '',
};

/**
 * Validate critical contract addresses on module load
 * Throws error if required contracts are missing or invalid
 */
export function validateContracts(): void {
  const criticalContracts = [
    { name: 'FACTORY', address: CONTRACTS.FACTORY },
    { name: 'ROUTER', address: CONTRACTS.ROUTER },
  ];

  const errors: string[] = [];

  for (const { name, address } of criticalContracts) {
    if (!address) {
      errors.push(`Missing environment variable: VITE_${name}_CONTRACT_ID`);
    } else if (!isValidContractId(address)) {
      errors.push(
        `Invalid ${name} contract address: ${address}. Must start with 'C' and be 56 characters long.`
      );
    }
  }

  if (errors.length > 0) {
    const errorMessage = [
      '❌ Contract Configuration Error:',
      ...errors,
      '',
      'Please check your .env file and ensure all required contract addresses are set.',
    ].join('\n');

    console.error(errorMessage);

    if (import.meta.env.DEV) {
      throw new Error(errorMessage);
    }
  }
}

// Validate contracts on module load
validateContracts();
