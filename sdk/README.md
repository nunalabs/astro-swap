# @astroswap/sdk

TypeScript SDK for AstroSwap DEX on Stellar/Soroban.

## Installation

```bash
pnpm add @astroswap/sdk @stellar/stellar-sdk
```

## Quick Start

```typescript
import { AstroSwapClient, NETWORKS, toContractAmount } from '@astroswap/sdk';

// Initialize client
const client = new AstroSwapClient({
  network: 'testnet',
  contracts: {
    factory: 'CDKZ4GWKTYA5SAW3MWEOSFCFXVPKATWXVZE2YKC3ADRN2O37Y5QTCAB3',
    router: 'CDRMQNYL56H6T2Y7K42RETRYAES5NWY3LXPH32BAHNQYSOA5ON66MLHN',
    staking: 'CABKPLO43CRGQRLERQCX3VDDOFMGQG7WQAVTPC6RT2X7GJBHMP3ON3MZ',
    aggregator: 'CDVJIG57HTTKD3A4QD6JSTL6ODBAW26DDJABOF7ZRQR2MELLQT7UV6RS',
  },
  secretKey: 'SXXX...', // Optional - needed for transactions
});

// Get swap quote
const quote = await client.getSwapQuote(
  tokenA,
  tokenB,
  toContractAmount(100, 7), // 100 tokens with 7 decimals
  50 // 0.5% slippage
);

console.log('Output:', quote.amountOut);
console.log('Price Impact:', quote.priceImpactBps / 100, '%');

// Execute swap
const result = await client.swap(tokenA, tokenB, quote.amountIn, 50);

if (result.status === 'success') {
  console.log('Swap successful:', result.hash);
}
```

## Contract Clients

### Factory Client

Manages pair creation and registry.

```typescript
// Create a new pair
const pair = await client.factory.createPair({
  tokenA: tokenA,
  tokenB: tokenB,
});

// Get pair address
const pairAddress = await client.factory.getPair(tokenA, tokenB);

// Get all pairs
const pairs = await client.factory.getAllPairs();
```

### Router Client

High-level swap and liquidity operations.

```typescript
// Swap tokens
const result = await client.router.swapExactTokensForTokens({
  amountIn: 1000000000n,
  amountOutMin: 900000000n,
  path: [tokenA, tokenB],
  to: recipientAddress,
  deadline: getDeadline(30 * 60), // 30 minutes
});

// Add liquidity
const liquidity = await client.router.addLiquidity({
  tokenA,
  tokenB,
  amountADesired: 1000000000n,
  amountBDesired: 1000000000n,
  amountAMin: 950000000n,
  amountBMin: 950000000n,
  to: recipientAddress,
  deadline: getDeadline(30 * 60),
});

// Remove liquidity
const withdrawal = await client.router.removeLiquidity({
  tokenA,
  tokenB,
  liquidity: 500000000n,
  amountAMin: 450000000n,
  amountBMin: 450000000n,
  to: recipientAddress,
  deadline: getDeadline(30 * 60),
});
```

### Pair Client

Direct interaction with liquidity pools.

```typescript
// Get pair client
const pair = await client.getPairClient(tokenA, tokenB);

// Get reserves
const reserves = await pair.getReserves();

// Calculate swap output
const { amountOut, priceImpactBps } = await pair.calculateAmountOut(
  1000000000n,
  tokenA
);

// Get current price
const { price0, price1 } = await pair.getPrice();

// Get LP token balance
const balance = await pair.getBalance(userAddress);
```

### Staking Client

LP token staking with rewards.

```typescript
// Stake LP tokens
await client.staking.stake(poolId, amount);

// Get pending rewards
const pending = await client.staking.getPendingRewards(poolId, userAddress);

// Claim rewards
await client.staking.claim(poolId);

// Unstake
await client.staking.unstake(poolId, amount);

// Calculate APR
const apr = await client.staking.calculateAPR(poolId, rewardPrice, lpPrice);
```

### Aggregator Client

Smart order routing across multiple DEXs.

```typescript
// Find best route
const route = await client.aggregator.findBestRoute(tokenIn, tokenOut, amountIn);

// Compare all protocols
const comparison = await client.aggregator.compareRoutes(tokenIn, tokenOut, amountIn);

console.log('Best protocol:', client.aggregator.getProtocolName(comparison.bestProtocol));
console.log('Best output:', comparison.bestAmount);

// Execute aggregated swap
const result = await client.aggregator.swapWithBestRoute(
  tokenIn,
  tokenOut,
  amountIn,
  50 // 0.5% slippage
);
```

### Bridge Client

Token graduation from Astro-Shiba launchpad.

```typescript
// Check if token is graduated
const isGraduated = await client.bridge.isGraduated(tokenAddress);

// Get graduated token info
const info = await client.bridge.getGraduatedToken(tokenAddress);

// Get recent graduations
const recent = await client.bridge.getRecentGraduations(10);
```

## Utilities

### Amount Conversion

```typescript
import { toContractAmount, fromContractAmount, formatAmount } from '@astroswap/sdk';

// Convert human-readable to contract amount
const amount = toContractAmount(100.5, 7); // 1005000000n

// Convert contract amount to human-readable
const readable = fromContractAmount(1005000000n, 7); // "100.5"

// Format with thousand separators
const formatted = formatAmount(1005000000n, 7, 2); // "100.50"
```

### Swap Calculations

```typescript
import { getAmountOut, calculatePriceImpact, withSlippage } from '@astroswap/sdk';

// Calculate output amount
const output = getAmountOut(amountIn, reserveIn, reserveOut, 30); // 30 bps fee

// Calculate price impact
const impact = calculatePriceImpact(amountIn, reserveIn, reserveOut, 30);

// Apply slippage tolerance
const minOutput = withSlippage(output, 50); // 0.5% slippage
```

### Address Utilities

```typescript
import { sortTokens, isValidAddress, shortenAddress } from '@astroswap/sdk';

// Sort tokens for consistent pair ordering
const [token0, token1] = sortTokens(tokenA, tokenB);

// Validate address
if (isValidAddress(address)) {
  // Valid Stellar address
}

// Shorten for display
const display = shortenAddress(address, 4); // "CXXX...XXXX"
```

## Networks

```typescript
import { NETWORKS } from '@astroswap/sdk';

// Use predefined network configs
const testnet = NETWORKS.testnet;
const mainnet = NETWORKS.mainnet;

// Or custom config
const custom = {
  network: 'custom',
  rpcUrl: 'https://my-rpc.example.com',
  networkPassphrase: 'My Custom Network',
};
```

## Error Handling

```typescript
import { AstroSwapError, AstroSwapErrorCode } from '@astroswap/sdk';

try {
  await client.swap(tokenA, tokenB, amount);
} catch (error) {
  if (error instanceof AstroSwapError) {
    switch (error.code) {
      case AstroSwapErrorCode.SlippageExceeded:
        console.log('Slippage too high, try increasing tolerance');
        break;
      case AstroSwapErrorCode.InsufficientLiquidity:
        console.log('Not enough liquidity in pool');
        break;
      case AstroSwapErrorCode.DeadlineExpired:
        console.log('Transaction took too long');
        break;
      default:
        console.log('Error:', error.message);
    }
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import type {
  SwapQuote,
  PairInfo,
  StakeInfo,
  TransactionResult,
  Protocol,
} from '@astroswap/sdk';
```

## License

MIT
