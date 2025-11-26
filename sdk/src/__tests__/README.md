# AstroSwap SDK Test Suite

Comprehensive unit tests for the AstroSwap TypeScript SDK using Vitest.

## Test Coverage

### 1. Utils Tests (`utils.test.ts`)

Tests all utility functions with extensive edge cases and property-based testing:

#### Math Utilities
- **getAmountOut** - Swap output calculations with constant product formula
- **getAmountIn** - Reverse swap calculations
- **getAmountsOut** - Multi-hop swap path calculations
- **getAmountsIn** - Reverse multi-hop calculations
- **quote** - Proportional liquidity quotes
- **sqrt** - Integer square root with Newton's method
- **calculateInitialLiquidity** - Initial LP token minting
- **calculateLiquidity** - LP tokens for existing pools
- **calculatePriceImpact** - Price impact in basis points
- **calculateShareOfPool** - Pool ownership percentage

#### Address Utilities
- **sortTokens** - Deterministic token ordering
- **isValidAddress** - Stellar address validation
- **shortenAddress** - Display formatting

#### Amount Utilities
- **toContractAmount** - Human-readable to contract format conversion
- **fromContractAmount** - Contract to human-readable format
- **formatAmount** - Display formatting with separators

#### Time Utilities
- **getDeadline** - Future timestamp calculation
- **isDeadlineExpired** - Deadline validation

#### Slippage Utilities
- **withSlippage** - Minimum amount with slippage
- **withSlippageUp** - Maximum amount with slippage

#### ScVal Utilities
- **scValToNative** - Soroban ScVal to JavaScript conversion
- **nativeToScValTyped** - JavaScript to typed ScVal conversion

#### Retry Utilities
- **retry** - Exponential backoff retry logic

### 2. Types Tests (`types.test.ts`)

Tests type definitions and error handling:

#### Network Configuration
- All network types (testnet, mainnet, futurenet, standalone)
- RPC URLs and network passphrases
- Friendbot availability
- Type safety and consistency

#### Error Handling
- **AstroSwapError** class functionality
- **fromCode** factory method for all 27 error codes
- Error code to message mapping
- Unknown error handling

#### Protocol Enum
- All supported protocols (AstroSwap, Soroswap, Phoenix, Aqua)
- Enum value consistency

### 3. Client Tests (`client.test.ts`)

Tests the main SDK client and its initialization:

#### Construction
- Network resolution (string vs config object)
- Contract address configuration
- Keypair management
- Optional contract client initialization

#### Keypair Management
- Public key getter
- setKeypair method
- Keypair propagation to all contract clients

#### Pair Client Management
- getPairClient with caching
- getPairClientByAddress
- Client reuse and caching

#### Convenience Methods
- getAllPairs delegation
- pairExists delegation
- swap helper with automatic slippage
- addLiquidity helper

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test utils.test.ts

# Run with coverage
pnpm test:coverage

# Run tests matching pattern
pnpm test -- --grep "getAmountOut"
```

## Test Patterns Used

### 1. Edge Case Testing
Every function is tested with:
- Zero values
- Negative values
- Very large numbers
- Boundary conditions
- Invalid inputs

### 2. Property-Based Testing
Math functions verify mathematical properties:
- Inverse operations (getAmountIn/getAmountOut)
- Monotonicity (larger inputs → larger outputs)
- Bounds checking
- Overflow/underflow handling

### 3. Mocking
Client tests use Vitest mocks for:
- Contract method calls
- Network interactions
- Factory/Router dependencies

### 4. Fixtures
Reusable test data:
- Valid Stellar addresses
- Mock contract IDs
- Test keypairs

## Coverage Goals

- **Statements**: >95%
- **Branches**: >90%
- **Functions**: >95%
- **Lines**: >95%

## Test File Structure

Each test file follows this pattern:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Group', () => {
  describe('Specific Function', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      // Test edge cases
    });

    it('should throw on invalid input', () => {
      // Test error cases
      expect(() => functionUnderTest(invalid)).toThrow();
    });
  });
});
```

## Continuous Integration

Tests should be run:
- On every commit (pre-commit hook)
- On pull requests
- Before deployment
- In CI/CD pipeline

## Future Improvements

- [ ] Add integration tests with real Soroban contracts
- [ ] Add performance benchmarks
- [ ] Add fuzz testing for math utilities
- [ ] Add snapshot testing for complex objects
- [ ] Add contract interaction e2e tests
