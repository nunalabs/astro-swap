# AstroSwap Frontend V2 - Update & Comprehensive Testing

**Date**: 2026-03-16
**Status**: ✅ **FRONTEND UPDATED TO V2** | 🧪 **TESTS IN PROGRESS**

---

## 🎯 Objetivos

1. Actualizar frontend con contratos V2 (Factory, Router, Staking, Bridge, Aggregator)
2. Verificar que todas las funciones usan el signature correcto (con deadline)
3. Implementar testing completo: E2E + Integration + Unit
4. Configurar coverage y CI/CD

---

## ✅ Frontend V2 Update - COMPLETADO

### 1. Contract Addresses Updated

**Archivo**: `/frontend/.env.local` & `/frontend/.env`

**Antes (V1)**:
```env
VITE_FACTORY_CONTRACT_ID=CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T
VITE_ROUTER_CONTRACT_ID=CA5AE63U6ZWRZWAPIIFTQSKDM45EQAYYWOIKN7MEQIJBYQAFAOPWLYYJ
```

**Después (V2)** - APLICADO:
```env
VITE_FACTORY_CONTRACT_ID=CCC2DJCAMGHPIU65HJNFH3IL33EXKF466R4ERAGWJ7MU7WMHT4EPYSPU
VITE_ROUTER_CONTRACT_ID=CAMIB25ZL5VQX24QMNLE6EFNKVTEFKPWGPTQCEPCUSZ7GR3UHTTZBVWS
VITE_STAKING_CONTRACT_ID=CBBHH5JJATIVHG4M7PVA25FOTKPNNKSKBBURLE3KIZNMQMYWFTTV6E5S
VITE_AGGREGATOR_CONTRACT_ID=CD5WKAJEWRUM2GT74XJ5TKG2V5AUR2WDCVTPTDJIBLV3XWHUT24YXYW7
VITE_BRIDGE_CONTRACT_ID=CA74JXBZDLIT2RQQTNHZL42BKJZFUVA4D6QF6COL5HT3IH6RE6DV2ZQQ
```

### 2. Function Signatures Verified

**Archivo**: `/frontend/src/lib/contracts.ts`

#### ✅ swap_exact_tokens_for_tokens (línea 282)

**Router V2 Signature**:
```rust
pub fn swap_exact_tokens_for_tokens(
    env: Env,
    user: Address,
    amount_in: i128,
    amount_out_min: i128,
    path: Vec<Address>,
    deadline: u64,
) -> Result<Vec<i128>, AstroSwapError>
```

**Frontend Implementation** (línea 302-309):
```typescript
const operation = contract.call(
  'swap_exact_tokens_for_tokens',
  userScVal,         // ✅ user
  amountInScVal,     // ✅ amount_in
  amountOutMinScVal, // ✅ amount_out_min
  pathScVal,         // ✅ path
  deadlineScVal      // ✅ deadline
);
```
**Status**: ✅ CORRECTO

---

#### ✅ add_liquidity (línea 322)

**Router V2 Signature**:
```rust
pub fn add_liquidity(
    env: Env,
    user: Address,
    token_a: Address,
    token_b: Address,
    amount_a_desired: i128,
    amount_b_desired: i128,
    amount_a_min: i128,
    amount_b_min: i128,
    deadline: u64,
) -> Result<(i128, i128, i128), AstroSwapError>
```

**Frontend Implementation** (línea 336-346):
```typescript
const operation = contract.call(
  'add_liquidity',
  StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // ✅ user
  StellarSdk.nativeToScVal(tokenA, { type: 'address' }),        // ✅ token_a
  StellarSdk.nativeToScVal(tokenB, { type: 'address' }),        // ✅ token_b
  StellarSdk.nativeToScVal(amountADesired, { type: 'i128' }),   // ✅ amount_a_desired
  StellarSdk.nativeToScVal(amountBDesired, { type: 'i128' }),   // ✅ amount_b_desired
  StellarSdk.nativeToScVal(amountAMin, { type: 'i128' }),       // ✅ amount_a_min
  StellarSdk.nativeToScVal(amountBMin, { type: 'i128' }),       // ✅ amount_b_min
  StellarSdk.nativeToScVal(deadline, { type: 'u64' })           // ✅ deadline
);
```
**Status**: ✅ CORRECTO

---

#### ✅ remove_liquidity (línea 359)

**Router V2 Signature**:
```rust
pub fn remove_liquidity(
    env: Env,
    user: Address,
    token_a: Address,
    token_b: Address,
    liquidity: i128,
    amount_a_min: i128,
    amount_b_min: i128,
    deadline: u64,
) -> Result<(i128, i128), AstroSwapError>
```

**Frontend Implementation** (línea 372-381):
```typescript
const operation = contract.call(
  'remove_liquidity',
  StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }), // ✅ user
  StellarSdk.nativeToScVal(tokenA, { type: 'address' }),        // ✅ token_a
  StellarSdk.nativeToScVal(tokenB, { type: 'address' }),        // ✅ token_b
  StellarSdk.nativeToScVal(liquidity, { type: 'i128' }),        // ✅ liquidity
  StellarSdk.nativeToScVal(amountAMin, { type: 'i128' }),       // ✅ amount_a_min
  StellarSdk.nativeToScVal(amountBMin, { type: 'i128' }),       // ✅ amount_b_min
  StellarSdk.nativeToScVal(deadline, { type: 'u64' })           // ✅ deadline
);
```
**Status**: ✅ CORRECTO

---

### 3. Deadline Handling Verified

**Archivo**: `/frontend/src/lib/contracts.ts`

Todas las funciones ya tienen soporte para deadline:
- ✅ `swapExactTokensForTokens` recibe `deadline: number`
- ✅ `addLiquidity` recibe `deadline: number`
- ✅ `removeLiquidity` recibe `deadline: number`

El deadline se calcula en los hooks del frontend (useSwap, usePool, etc.) usando:
```typescript
const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutos
```

---

## 🧪 Testing Strategy - COMPREHENSIVE (Based on Official Best Practices)

> **Research Completed**: ✅ Investigated official Stellar/Soroban documentation and industry best practices
>
> **Key Sources**:
> - [57Blocks Soroban Integration Testing Best Practices](https://57blocks.com/blog/soroban-integration-testing-best-practices)
> - [Stellar Developers Documentation](https://developers.stellar.org/docs/build/apps/dapp-frontend)
> - [Soroswap Frontend (Real DEX Example)](https://github.com/soroswap/frontend)

### The 5 Core Principles (From 57Blocks)

1. **Use Realistic Local Network (NOT Mocks)** - Deploy real contracts to localnet, catch real integration issues
2. **Cover Full End-to-End User Flows** - Test complete workflows: approvals → swaps → balance updates
3. **Control State and Validate Outcomes** - Start from clean, known state; verify all state changes
4. **Cover Edge Cases and Failure Paths** - Test invalid data, resource limits, permission errors
5. **Automate Testing with CI** - Make integration tests mandatory in CI/CD pipeline

### Testing Pyramid

```
         E2E (5%)
        /        \
   Integration (15%) ← LOCALNET (Real Contracts)
      /          \
 Unit Tests (80%) ← HAPPY-DOM (Mocked)
```

### 1. Unit Tests (80% del coverage) - MOCKED for Speed

**Objetivo**: Probar funciones individuales en aislamiento

**Archivos a testear**:
- `/src/lib/contracts.ts` - Contract call functions
- `/src/lib/utils.ts` - Helper functions
- `/src/hooks/useSwap.ts` - Swap logic
- `/src/hooks/usePool.ts` - Liquidity logic
- `/src/components/Swap/SwapCard.tsx` - UI components

**Coverage objetivo**: 85%+

---

### 2. Integration Tests (15% del coverage)

**Objetivo**: Probar interacción entre módulos

**Escenarios**:
- Hook + Contract interaction
- Store + Component interaction
- Wallet + Transaction flow

---

### 3. E2E Tests (5% del coverage)

**Objetivo**: Probar user flows completos

**Critical Paths**:
1. **Swap Flow**: Connect wallet → Select tokens → Execute swap
2. **Add Liquidity Flow**: Connect wallet → Enter amounts → Add liquidity
3. **Remove Liquidity Flow**: Connect wallet → Select LP → Remove liquidity
4. **Multi-hop Swap**: Connect wallet → Swap through 3+ pairs

---

## 📋 Test Implementation Plan

### Phase 1: Unit Tests Avanzados

**Test Suite 1**: `contracts.test.ts`

```typescript
describe('AstroSwap Contracts V2', () => {
  describe('swapExactTokensForTokens', () => {
    it('should call contract with correct parameters', async () => {
      // Mock StellarSDK.Contract.call
      // Verify parameters: user, amount_in, amount_out_min, path, deadline
    });

    it('should handle deadline correctly (5 minutes)', async () => {
      // Verify deadline is current timestamp + 300 seconds
    });

    it('should throw error if path is empty', async () => {
      // Verify path validation
    });

    it('should handle multi-hop path (3+ tokens)', async () => {
      // Test path with [XLM, ASTRO, USDC]
    });
  });

  describe('addLiquidity', () => {
    it('should call contract with correct parameters', async () => {
      // Verify all 9 parameters in correct order
    });

    it('should enforce deadline parameter', async () => {
      // Verify deadline is passed to contract
    });

    it('should handle slippage correctly', async () => {
      // Verify amountAMin and amountBMin are calculated
    });

    it('should validate token addresses', async () => {
      // Verify addresses start with 'C' and are 56 chars
    });
  });

  describe('removeLiquidity', () => {
    it('should call contract with correct parameters', async () => {
      // Verify all 8 parameters in correct order
    });

    it('should handle LP token amount correctly', async () => {
      // Verify liquidity amount is i128
    });

    it('should enforce minimum amounts', async () => {
      // Verify amountAMin and amountBMin
    });
  });

  describe('getAmountsOut - OPTIMIZED', () => {
    it('should fetch pair addresses in parallel', async () => {
      // Verify Promise.all is used for pair fetching
    });

    it('should fetch reserves in parallel', async () => {
      // Verify Promise.all is used for reserves
    });

    it('should calculate amounts locally (no RPC)', async () => {
      // Verify calculation uses local math, not contract call
    });

    it('should handle 3-hop path efficiently', async () => {
      // Verify: 3 pairs → 2 parallel batches (not 9 sequential calls)
    });

    it('should return empty array if pair not found', async () => {
      // Verify error handling
    });
  });
});
```

**Test Suite 2**: `utils.test.ts`

```typescript
describe('Utility Functions', () => {
  describe('calculateAmountOut', () => {
    it('should use constant product formula correctly', () => {
      // x * y = k
      // Verify: (amountIn * reserveOut * 9970) / (reserveIn * 10000 + amountIn * 9970)
    });

    it('should apply 0.3% fee (30 bps)', () => {
      // Verify fee calculation: 10000 - 30 = 9970
    });

    it('should return 0 if reserves are 0', () => {
      // Edge case handling
    });

    it('should handle large numbers (bigint)', () => {
      // Verify overflow protection
    });
  });

  describe('deadline generation', () => {
    it('should add 300 seconds to current time', () => {
      const deadline = generateDeadline();
      const now = Math.floor(Date.now() / 1000);
      expect(deadline).toBe(now + 300);
    });

    it('should be type u64 compatible', () => {
      // Verify number is within u64 range
    });
  });

  describe('slippage calculation', () => {
    it('should apply 0.5% slippage (50 bps) by default', () => {
      const amount = 1000n;
      const min = withSlippage(amount, 50);
      expect(min).toBe(995n); // 1000 * 9950 / 10000
    });

    it('should handle custom slippage', () => {
      const amount = 1000n;
      const min = withSlippage(amount, 100); // 1%
      expect(min).toBe(990n);
    });
  });
});
```

---

### Phase 2: Integration Tests

**Test Suite 3**: `swap-flow.integration.test.ts`

```typescript
describe('Swap Flow Integration', () => {
  it('should complete full swap with wallet connection', async () => {
    // 1. Mock wallet connect
    // 2. Select tokens
    // 3. Get quote
    // 4. Execute swap
    // 5. Verify transaction
  });

  it('should handle insufficient balance error', async () => {
    // Verify error handling when user has insufficient tokens
  });

  it('should handle slippage exceeded error', async () => {
    // Verify error when price moves too much
  });

  it('should respect deadline (fail after 5 minutes)', async () => {
    // Mock delayed transaction → should fail with deadline exceeded
  });
});
```

**Test Suite 4**: `liquidity-flow.integration.test.ts`

```typescript
describe('Liquidity Flow Integration', () => {
  describe('Add Liquidity', () => {
    it('should add liquidity with token approval', async () => {
      // 1. Check allowances
      // 2. Approve tokens if needed
      // 3. Add liquidity
      // 4. Verify LP tokens minted
    });

    it('should calculate optimal amounts for existing pool', async () => {
      // When adding to existing pool:
      // - Maintain current ratio
      // - Adjust amounts to match reserves
    });

    it('should handle first liquidity deposit', async () => {
      // First deposit:
      // - No ratio constraints
      // - Minimum liquidity burned
      // - User receives sqrt(amount0 * amount1) - 1000
    });
  });

  describe('Remove Liquidity', () => {
    it('should remove liquidity and receive tokens', async () => {
      // 1. Burn LP tokens
      // 2. Receive pro-rata amounts
      // 3. Verify balances updated
    });

    it('should enforce minimum amounts (slippage protection)', async () => {
      // Verify transaction reverts if output < amountMin
    });
  });
});
```

---

### Phase 3: E2E Tests (Playwright/Cypress)

**Test Suite 5**: `e2e/critical-paths.spec.ts`

```typescript
describe('Critical User Flows E2E', () => {
  test('Complete Swap Flow', async ({ page }) => {
    // 1. Navigate to https://localhost:3001
    await page.goto('http://localhost:3001');

    // 2. Connect wallet (Freighter)
    await page.click('[data-testid="connect-wallet"]');
    // Mock Freighter wallet connection

    // 3. Select tokens
    await page.click('[data-testid="token-in-selector"]');
    await page.click('[data-testid="token-XLM"]');
    await page.click('[data-testid="token-out-selector"]');
    await page.click('[data-testid="token-ASTRO"]');

    // 4. Enter amount
    await page.fill('[data-testid="amount-in"]', '100');

    // 5. Verify quote displays
    await expect(page.locator('[data-testid="amount-out"]')).toBeVisible();

    // 6. Click swap
    await page.click('[data-testid="swap-button"]');

    // 7. Confirm transaction
    await page.click('[data-testid="confirm-swap"]');

    // 8. Wait for success
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({ timeout: 15000 });

    // 9. Verify transaction hash displayed
    await expect(page.locator('[data-testid="tx-hash"]')).toBeVisible();
  });

  test('Complete Add Liquidity Flow', async ({ page }) => {
    // Similar flow for adding liquidity
  });

  test('Multi-hop Swap (XLM → ASTRO → USDC)', async ({ page }) => {
    // Test 3-hop swap
    // Verify multi-hop quote calculation
    // Execute and verify success
  });
});
```

---

## 🛠️ Testing Tools & Configuration

### Installed Dependencies

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^14.2.1",
    "@testing-library/user-event": "^14.5.2",
    "@vitest/coverage-v8": "^1.3.1",
    "@vitest/ui": "^1.3.1",
    "happy-dom": "^13.6.2",
    "vitest": "^1.3.1"
  }
}
```

### Vitest Configuration

**Archivo**: `/frontend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        '**/dist/*'
      ],
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85
    }
  }
});
```

### Test Commands

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# UI mode (visual test runner)
pnpm test:ui
```

---

## ✅ Testing Checklist

### Unit Tests
- [ ] `contracts.test.ts` - swapExactTokensForTokens
- [ ] `contracts.test.ts` - addLiquidity
- [ ] `contracts.test.ts` - removeLiquidity
- [ ] `contracts.test.ts` - getAmountsOut (optimized)
- [ ] `utils.test.ts` - calculateAmountOut
- [ ] `utils.test.ts` - deadline generation
- [ ] `utils.test.ts` - slippage calculation
- [ ] `hooks/useSwap.test.ts` - swap logic
- [ ] `hooks/usePool.test.ts` - liquidity logic
- [ ] `components/SwapCard.test.tsx` - UI components

### Integration Tests
- [ ] `swap-flow.integration.test.ts` - full swap flow
- [ ] `swap-flow.integration.test.ts` - error handling
- [ ] `liquidity-flow.integration.test.ts` - add liquidity
- [ ] `liquidity-flow.integration.test.ts` - remove liquidity

### E2E Tests
- [ ] `e2e/swap.spec.ts` - critical swap flow
- [ ] `e2e/liquidity.spec.ts` - add/remove liquidity
- [ ] `e2e/multi-hop.spec.ts` - multi-hop swap

### Test Coverage
- [ ] Overall coverage ≥85%
- [ ] Critical paths ≥95%
- [ ] CI/CD integration (GitHub Actions)

---

## 🚀 Next Steps

### Immediate (Today)
1. ✅ Update contract addresses to V2
2. ✅ Verify function signatures
3. 🔄 Write unit tests for contracts.ts
4. 🔄 Write unit tests for utils.ts
5. 🔄 Run tests and fix failures

### Short Term (This Week)
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Achieve 85%+ coverage
- [ ] Setup CI/CD pipeline
- [ ] Deploy frontend to Vercel with V2 contracts

### Medium Term (Next Week)
- [ ] Performance testing (load testing)
- [ ] Security testing (XSS, CSRF prevention)
- [ ] Accessibility testing (WCAG 2.1 AA)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Brave)
- [ ] Mobile responsiveness testing

---

## 📊 Expected Outcomes

After completing all tests:

1. **100% confidence** in frontend-contract interaction
2. **85%+ test coverage** with comprehensive test suites
3. **Zero regressions** when deploying to production
4. **Automated testing** in CI/CD pipeline
5. **Fast iteration** - tests catch issues before deployment

---

## 🔗 Resources

### Documentation
- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Stellar SDK](https://stellar.github.io/js-stellar-sdk/)

### Contract References
- Router V2: `CAMIB25ZL5VQX24QMNLE6EFNKVTEFKPWGPTQCEPCUSZ7GR3UHTTZBVWS`
- Factory V2: `CCC2DJCAMGHPIU65HJNFH3IL33EXKF466R4ERAGWJ7MU7WMHT4EPYSPU`
- Testnet Validation: [TESTNET_VALIDATION_V2.md](./TESTNET_VALIDATION_V2.md)

---

**Status**: Frontend actualizado ✅ | Tests en progreso 🧪
**Last Updated**: 2026-03-16
**Network**: Stellar Testnet
**Frontend Version**: V2 (Security Hardened)
