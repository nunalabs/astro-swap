# Soroban Testing Best Practices - Official Guidelines

**Based on**: Official Stellar Documentation + Industry Best Practices
**Date**: 2026-03-16
**References**:
- [57Blocks Soroban Integration Testing](https://57blocks.com/blog/soroban-integration-testing-best-practices)
- [Stellar Developers Documentation](https://developers.stellar.org/docs/build/apps/dapp-frontend)
- [Soroswap Frontend (Real-World Example)](https://github.com/soroswap/frontend)

---

## 🎯 The 5 Core Practices (57Blocks Best Practices)

### 1. Use Realistic Local Network (NOT Mocks)

**❌ Don't**: Mock contracts in integration tests
```typescript
// BAD: Mocking hides real integration issues
const mockRouter = {
  swap: vi.fn().mockResolvedValue('1000')
};
```

**✅ Do**: Use Soroban localnet with real contracts
```typescript
// GOOD: Deploy real contracts to localnet
before(async () => {
  await stellar.container.start('local');
  contractId = await deployContract('router', network='local');
});
```

**Why**: Catches bugs that unit tests miss:
- Inter-contract state issues
- Resource limits (CPU, memory)
- Actual ledger rules and token balances

---

### 2. Cover Full End-to-End User Flows

**❌ Don't**: Test functions in isolation
```typescript
// BAD: Testing swap() alone misses token approval flow
it('should swap tokens', async () => {
  await router.swap(amount, path);
});
```

**✅ Do**: Test complete workflows
```typescript
// GOOD: Complete user journey
it('should execute full swap flow', async () => {
  // 1. Check allowances
  const allowance = await tokenA.allowance(user, router);

  // 2. Approve if needed
  if (allowance < amount) {
    await tokenA.approve(router, amount);
  }

  // 3. Execute swap
  const result = await router.swap(amount, path);

  // 4. Verify balance changes
  const newBalance = await tokenA.balance(user);
  expect(newBalance).toBe(oldBalance - amount);
});
```

**Covers**:
- Token approvals
- Balance updates
- Mutual contract interactions
- State transitions

---

### 3. Control State and Validate Outcomes

**❌ Don't**: Rely on unpredictable state
```typescript
// BAD: Test depends on unknown initial state
it('should add liquidity', async () => {
  await router.addLiquidity(token0, token1, amount0, amount1);
  // What was the state before? Unknown!
});
```

**✅ Do**: Start from clean, known state
```typescript
// GOOD: Controlled state management
describe('Add Liquidity', () => {
  beforeEach(async () => {
    // Reset to clean state
    await resetLocalnet();

    // Setup known initial state
    await mintTokens(user, token0, 10000);
    await mintTokens(user, token1, 100000);
    await approveTokens(user, router, [token0, token1]);

    // Verify initial state
    const reserves = await pair.getReserves();
    expect(reserves).toEqual([0, 0]);
  });

  it('should add initial liquidity correctly', async () => {
    const [amount0, amount1, liquidity] = await router.addLiquidity(
      token0, token1, 1000, 10000, 950, 9500, user, deadline
    );

    // Validate outcomes
    expect(amount0).toBe(1000);
    expect(amount1).toBe(10000);
    expect(liquidity).toBe(Math.sqrt(1000 * 10000) - 1000); // First deposit formula

    // Verify state changes
    const reserves = await pair.getReserves();
    expect(reserves).toEqual([1000, 10000]);

    const lpBalance = await pair.balanceOf(user);
    expect(lpBalance).toBe(liquidity);
  });
});
```

---

### 4. Cover Edge Cases and Failure Paths

**❌ Don't**: Only test happy paths
```typescript
// BAD: What if amount is 0? What if deadline expired?
it('should swap tokens', async () => {
  const result = await router.swap(100, [tokenA, tokenB]);
  expect(result).toBeDefined();
});
```

**✅ Do**: Test failure modes deliberately
```typescript
// GOOD: Comprehensive edge case coverage
describe('Swap Edge Cases', () => {
  it('should reject zero amount', async () => {
    await expect(
      router.swap(0, [tokenA, tokenB])
    ).rejects.toThrow('Amount must be greater than zero');
  });

  it('should reject expired deadline', async () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 100;
    await expect(
      router.swap(100, [tokenA, tokenB], pastDeadline)
    ).rejects.toThrow('Transaction expired');
  });

  it('should reject insufficient balance', async () => {
    const hugeAmount = 1000000000000n;
    await expect(
      router.swap(hugeAmount, [tokenA, tokenB])
    ).rejects.toThrow('Insufficient balance');
  });

  it('should reject slippage exceeded', async () => {
    // Simulate price movement
    await executeExternalSwap(tokenA, tokenB, 1000000);

    await expect(
      router.swap(100, [tokenA, tokenB], minAmountOut=99)
    ).rejects.toThrow('Slippage exceeded');
  });

  it('should reject invalid path', async () => {
    await expect(
      router.swap(100, []) // Empty path
    ).rejects.toThrow('Invalid path');
  });

  it('should handle resource limit exceeded', async () => {
    // Create very long path (exceeds CPU limit)
    const longPath = Array(50).fill(null).map((_, i) => `TOKEN_${i}`);

    await expect(
      router.swap(100, longPath)
    ).rejects.toThrow('tx_insufficient_fee');
  });
});
```

**Tests prevent**:
- Exploits
- Edge case crashes
- Unexpected behavior in production

---

### 5. Automate Testing with CI

**❌ Don't**: Run tests manually
```bash
# BAD: Developers forget to run tests before push
git push origin main  # Oops, forgot to test!
```

**✅ Do**: Mandatory CI pipeline
```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install Stellar CLI
        run: |
          cargo install --locked stellar-cli --features opt

      - name: Start Soroban Localnet
        run: |
          stellar container start local

      - name: Install Dependencies
        run: pnpm install

      - name: Run Integration Tests
        run: pnpm test:integration

      - name: Run Unit Tests
        run: pnpm test:unit

      - name: Check Coverage
        run: pnpm test:coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v3

      - name: Stop Localnet
        if: always()
        run: stellar container stop local
```

---

## 🛠️ Recommended Tooling Stack

### Core Tools

```json
{
  "devDependencies": {
    // Test Framework
    "@vitest/ui": "^1.6.1",
    "vitest": "^1.6.1",

    // Stellar SDK
    "@stellar/stellar-sdk": "^13.0.0",

    // Testing Libraries
    "@testing-library/react": "^14.2.1",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.4.2",

    // Coverage
    "@vitest/coverage-v8": "^1.3.1",

    // Resource Profiling (Optional but Recommended)
    "@57blocks/stellar-resource-usage": "^1.0.0"
  }
}
```

### Stellar CLI (Required for Integration Tests)

```bash
# Install Stellar CLI v25.2.0+
cargo install --locked stellar-cli --features opt

# Verify installation
stellar version  # Should be 25.2.0 or higher
```

---

## 📁 Recommended Project Structure

```
astro-swap/
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── contracts.ts
│   │   │   └── __tests__/
│   │   │       ├── contracts.unit.test.ts      # Unit tests (mocked)
│   │   │       └── contracts.integration.test.ts # Integration (localnet)
│   │   ├── hooks/
│   │   │   ├── useSwap.ts
│   │   │   └── __tests__/
│   │   │       └── useSwap.test.ts
│   │   └── components/
│   │       └── Swap/
│   │           ├── SwapCard.tsx
│   │           └── __tests__/
│   │               └── SwapCard.test.tsx
│   ├── tests/
│   │   ├── integration/                   # ← Integration tests (localnet)
│   │   │   ├── setup.ts
│   │   │   ├── helpers.ts
│   │   │   ├── swap-flow.test.ts
│   │   │   ├── liquidity-flow.test.ts
│   │   │   └── multi-hop.test.ts
│   │   ├── e2e/                           # ← E2E tests (Playwright/Cypress)
│   │   │   ├── swap.spec.ts
│   │   │   ├── pool.spec.ts
│   │   │   └── wallet.spec.ts
│   │   └── utils/
│   │       ├── stellar-helpers.ts
│   │       └── test-accounts.ts
│   ├── vitest.config.ts
│   ├── vitest.integration.config.ts       # ← Separate config for integration
│   └── package.json
└── contracts/                              # ← Rust contracts (separate testing)
```

---

## ⚙️ Vitest Configuration (Dual Mode)

### Unit Tests Config (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/integration/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts'],
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
    },
  },
});
```

### Integration Tests Config (`vitest.integration.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',  // Node environment for Stellar SDK
    setupFiles: ['./tests/integration/setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,  // Longer timeout for blockchain operations
    hookTimeout: 60000,  // Time for localnet startup
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:all": "pnpm test:unit && pnpm test:integration && pnpm test:e2e",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "stellar:start": "stellar container start local",
    "stellar:stop": "stellar container stop local",
    "stellar:reset": "stellar container stop local && stellar container start local"
  }
}
```

---

## 📝 Integration Test Example (Based on Best Practices)

```typescript
// tests/integration/swap-flow.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test configuration
const LOCALNET_RPC = 'http://localhost:8000/soroban/rpc';
const LOCALNET_PASSPHRASE = 'Standalone Network ; February 2017';

// Contract IDs (deployed to localnet in setup)
let factoryId: string;
let routerId: string;
let xlmTokenId: string;
let usdcTokenId: string;
let testAccount: StellarSdk.Keypair;
let server: StellarSdk.SorobanRpc.Server;

describe('Swap Flow - Integration Test (Localnet)', () => {
  beforeAll(async () => {
    // Start localnet
    await execAsync('stellar container start local');

    // Initialize server
    server = new StellarSdk.SorobanRpc.Server(LOCALNET_RPC);

    // Create test account
    testAccount = StellarSdk.Keypair.random();
    await fundAccount(testAccount.publicKey());

    // Deploy contracts
    factoryId = await deployContract('factory');
    routerId = await deployContract('router');

    // Initialize router with factory
    await initializeRouter(routerId, factoryId, testAccount.publicKey());

    // Create test tokens
    xlmTokenId = await deployToken('XLM', testAccount.publicKey());
    usdcTokenId = await deployToken('USDC', testAccount.publicKey());

    // Mint tokens to test account
    await mintTokens(xlmTokenId, testAccount.publicKey(), 10000_0000000n);
    await mintTokens(usdcTokenId, testAccount.publicKey(), 100000_0000000n);

    // Create pair
    await createPair(factoryId, xlmTokenId, usdcTokenId);

    // Add initial liquidity
    await addInitialLiquidity(
      routerId,
      xlmTokenId,
      usdcTokenId,
      1000_0000000n,  // 1000 XLM
      10000_0000000n  // 10000 USDC
    );
  }, 60000); // 60s timeout for setup

  afterAll(async () => {
    // Stop localnet
    await execAsync('stellar container stop local');
  });

  beforeEach(async () => {
    // Reset to known state before each test
    // (In real implementation, use snapshots for faster resets)
  });

  it('should execute complete swap flow with token approvals', async () => {
    // ARRANGE
    const swapAmount = 100_0000000n; // 100 XLM
    const minAmountOut = 900_0000000n; // 900 USDC minimum (10% slippage)
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    // Get initial balances
    const initialXLM = await getTokenBalance(xlmTokenId, testAccount.publicKey());
    const initialUSDC = await getTokenBalance(usdcTokenId, testAccount.publicKey());

    // Check allowance
    const allowance = await getTokenAllowance(
      xlmTokenId,
      testAccount.publicKey(),
      routerId
    );

    // ACT 1: Approve tokens if needed
    if (allowance < swapAmount) {
      await approveToken(xlmTokenId, routerId, swapAmount, testAccount);
    }

    // ACT 2: Execute swap
    const swapTx = await buildSwapTx({
      user: testAccount.publicKey(),
      amountIn: swapAmount,
      amountOutMin: minAmountOut,
      path: [xlmTokenId, usdcTokenId],
      deadline,
      contractId: routerId,
    });

    const result = await submitTransaction(swapTx, testAccount);

    // ASSERT
    expect(result.status).toBe('SUCCESS');

    // Verify balance changes
    const finalXLM = await getTokenBalance(xlmTokenId, testAccount.publicKey());
    const finalUSDC = await getTokenBalance(usdcTokenId, testAccount.publicKey());

    expect(finalXLM).toBe(initialXLM - swapAmount);
    expect(finalUSDC).toBeGreaterThan(initialUSDC + minAmountOut);

    // Verify event emission
    const events = result.events.filter(e => e.type === 'Swap');
    expect(events).toHaveLength(1);
    expect(events[0].data.amountIn).toBe(swapAmount.toString());
  });

  it('should reject swap with expired deadline', async () => {
    // ARRANGE
    const pastDeadline = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago

    // ACT & ASSERT
    await expect(
      buildSwapTx({
        user: testAccount.publicKey(),
        amountIn: 100_0000000n,
        amountOutMin: 900_0000000n,
        path: [xlmTokenId, usdcTokenId],
        deadline: pastDeadline,
        contractId: routerId,
      }).then(tx => submitTransaction(tx, testAccount))
    ).rejects.toThrow(/deadline|expired/i);
  });

  it('should reject swap with insufficient balance', async () => {
    // ARRANGE
    const hugeAmount = 1000000_0000000n; // 1M XLM (more than balance)

    // Approve huge amount
    await approveToken(xlmTokenId, routerId, hugeAmount, testAccount);

    // ACT & ASSERT
    await expect(
      buildSwapTx({
        user: testAccount.publicKey(),
        amountIn: hugeAmount,
        amountOutMin: 1n,
        path: [xlmTokenId, usdcTokenId],
        deadline: Math.floor(Date.now() / 1000) + 300,
        contractId: routerId,
      }).then(tx => submitTransaction(tx, testAccount))
    ).rejects.toThrow(/insufficient balance/i);
  });

  it('should handle slippage protection correctly', async () => {
    // ARRANGE
    const swapAmount = 100_0000000n;
    const unrealisticMinOut = 10000_0000000n; // Expecting 10000 USDC for 100 XLM (impossible)

    await approveToken(xlmTokenId, routerId, swapAmount, testAccount);

    // ACT & ASSERT
    await expect(
      buildSwapTx({
        user: testAccount.publicKey(),
        amountIn: swapAmount,
        amountOutMin: unrealisticMinOut,
        path: [xlmTokenId, usdcTokenId],
        deadline: Math.floor(Date.now() / 1000) + 300,
        contractId: routerId,
      }).then(tx => submitTransaction(tx, testAccount))
    ).rejects.toThrow(/slippage|insufficient output/i);
  });
});

// Helper functions
async function deployContract(name: string): Promise<string> {
  const { stdout } = await execAsync(
    `stellar contract deploy \
      --wasm target/wasm32v1-none/release/astroswap_${name}.wasm \
      --source testpayer \
      --network local`
  );
  return stdout.trim();
}

async function fundAccount(address: string): Promise<void> {
  await execAsync(`stellar keys fund ${address} --network local`);
}

async function getTokenBalance(tokenId: string, owner: string): Promise<bigint> {
  const contract = new StellarSdk.Contract(tokenId);
  const operation = contract.call('balance',
    StellarSdk.nativeToScVal(owner, { type: 'address' })
  );

  const result = await simulateTransaction(operation);
  return BigInt(StellarSdk.scValToBigInt(result.retval));
}

// ... more helpers
```

---

## 📚 Sources & References

- **57Blocks Best Practices**: https://57blocks.com/blog/soroban-integration-testing-best-practices
- **Stellar Documentation - Frontend**: https://developers.stellar.org/docs/build/apps/dapp-frontend
- **Stellar Documentation - Freighter**: https://developers.stellar.org/docs/build/guides/freighter
- **Soroswap Frontend Example**: https://github.com/soroswap/frontend
- **Stellar SDK Documentation**: https://stellar.github.io/js-stellar-sdk/

---

**Last Updated**: 2026-03-16
**Status**: ✅ Research Complete - Implementation in Progress
