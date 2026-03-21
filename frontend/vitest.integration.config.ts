import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration - Integration Tests
 *
 * Environment: Node (for Stellar SDK + shell commands)
 * Tests: Real contracts on Soroban localnet
 * Speed: Slow (blockchain operations)
 * Coverage: Critical user flows end-to-end
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Node environment for exec(), StellarSDK
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30s for blockchain operations
    hookTimeout: 120000, // 2 minutes for beforeAll (contract deployment)
    bail: 1, // Stop on first failure (saves time in CI)
    reporters: ['verbose'],
    coverage: {
      enabled: false, // Integration tests don't need coverage (unit tests cover that)
    },
  },
});
