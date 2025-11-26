# Quick Start Guide - AstroSwap Router SDK

Get started with the AstroSwap Router SDK in 5 minutes.

## Installation

```bash
npm install @astroswap/sdk
# or
yarn add @astroswap/sdk
```

## Basic Setup

```typescript
import { AstroSwapRouter, NETWORKS } from '@astroswap/sdk';

// Create router instance
const router = new AstroSwapRouter({
  factoryAddress: 'YOUR_FACTORY_ADDRESS',
  network: NETWORKS.testnet,
});
```

## Common Use Cases

### 1. Find Best Route for Small Trade

```typescript
// Swap 100 USDC for XLM
const route = await router.findBestRoute(
  'CUSDC_ADDRESS',
  'CXLM_ADDRESS',
  100_0000000n // 100 USDC (7 decimals)
);

if (route) {
  console.log('Route found:', route.path.join(' -> '));
  console.log('Expected output:', route.expectedOutput);
  console.log('Price impact:', route.priceImpactBps / 100, '%');
} else {
  console.log('No route available');
}
```

### 2. Find Best Route with Quote

```typescript
// Get detailed quote
const route = await router.findBestRoute(
  'CUSDC_ADDRESS',
  'CXLM_ADDRESS',
  1000_0000000n
);

if (route) {
  const quote = await router.getRouteQuote(route, 1000_0000000n);

  console.log('Route:', quote.route.path.join(' -> '));
  console.log('Input:', quote.amountIn);
  console.log('Output:', quote.amountOut);

  // Hop-by-hop breakdown
  quote.hops.forEach((hop, i) => {
    console.log(`Hop ${i + 1}: ${hop.tokenIn} -> ${hop.tokenOut}`);
    console.log(`  Amount: ${hop.amountOut}`);
    console.log(`  Impact: ${hop.priceImpactBps / 100}%`);
  });
}
```

### 3. Optimize Large Trade with Split Routing

```typescript
// Large trade: 50,000 USDC
const split = await router.findOptimalSplit(
  'CUSDC_ADDRESS',
  'CXLM_ADDRESS',
  50000_0000000n,
  3 // max 3 routes
);

console.log(`Splitting across ${split.routes.length} routes:`);

split.routes.forEach((route, i) => {
  console.log(`Route ${i + 1} (${split.percentages[i]}%):`);
  console.log(`  Path: ${route.path.join(' -> ')}`);
  console.log(`  Amount: ${split.amounts[i]}`);
});

console.log('Total output:', split.totalOutput);
console.log('Price impact:', split.totalPriceImpactBps / 100, '%');
console.log('Better than single route:', split.isBetterThanSingleRoute);
```

### 4. Compare All Available Routes

```typescript
// Find all possible routes
const routes = await router.findAllRoutes(
  'CUSDC_ADDRESS',
  'CBTC_ADDRESS',
  3 // max 3 hops
);

console.log(`Found ${routes.length} routes:\n`);

// Show top 5
routes.slice(0, 5).forEach((route, i) => {
  console.log(`${i + 1}. ${route.path.join(' -> ')}`);
  console.log(`   Score: ${route.score.toFixed(4)}`);
  console.log(`   Hops: ${route.pools.length}`);
});
```

### 5. Custom Route Filtering

```typescript
import { Pathfinder } from '@astroswap/sdk';

// Find all routes
const allRoutes = await router.findAllRoutes('CUSDC', 'CXLM');

// Filter routes with max 2 hops
const shortRoutes = allRoutes.filter(r => r.pools.length <= 2);

// Filter routes with low price impact (<1%)
const lowImpactRoutes = Pathfinder.filterRoutes(
  allRoutes,
  undefined, // no min output
  100 // max 1% impact
);

// Get top 3 best routes
const topRoutes = Pathfinder.getTopRoutes(allRoutes, 3);

console.log('Short routes:', shortRoutes.length);
console.log('Low impact routes:', lowImpactRoutes.length);
console.log('Top 3:', topRoutes.map(r => r.path.join(' -> ')));
```

### 6. Monitor Router Performance

```typescript
// Perform some routing operations
await router.findBestRoute('CUSDC', 'CXLM', 1000_0000000n);
await router.findBestRoute('CUSDC', 'CBTC', 1000_0000000n);
await router.findOptimalSplit('CUSDC', 'CXLM', 50000_0000000n);

// Get statistics
const stats = router.getStats();

console.log('Router Statistics:');
console.log('  Cached pools:', stats.cachedPools);
console.log('  Cache hit rate:', (stats.cacheHitRate * 100).toFixed(2), '%');
console.log('  Avg route finding time:', stats.avgRouteFindingTime.toFixed(2), 'ms');
console.log('  Total routes found:', stats.totalRoutesFound);
```

### 7. Refresh Pool Data

```typescript
// Soft refresh (only expired entries)
await router.refreshPools();

// Force refresh (all pools)
await router.refreshPools(true);

// Clear cache completely
router.clearCache();
```

## Configuration Options

### Production Config (Mainnet)

```typescript
const router = new AstroSwapRouter({
  factoryAddress: 'MAINNET_FACTORY_ADDRESS',
  network: NETWORKS.mainnet,
  maxHops: 3,           // Balance between coverage and performance
  maxSplits: 3,         // Optimize large trades
  poolCacheTTL: 30000,  // 30 seconds
  enableCache: true,    // Enable for production
  minLiquidity: 10000n, // Filter out tiny pools
});
```

### Development Config (Testnet)

```typescript
const router = new AstroSwapRouter({
  factoryAddress: 'TESTNET_FACTORY_ADDRESS',
  network: NETWORKS.testnet,
  maxHops: 4,           // More exploration
  maxSplits: 2,         // Simpler for testing
  poolCacheTTL: 60000,  // 1 minute (slower testnet)
  enableCache: true,
  minLiquidity: 100n,   // Lower threshold
});
```

### High-Performance Config

```typescript
const router = new AstroSwapRouter({
  factoryAddress: 'FACTORY_ADDRESS',
  network: NETWORKS.mainnet,
  maxHops: 2,           // Limit to direct and 1-hop
  maxSplits: 2,         // Reduce complexity
  poolCacheTTL: 15000,  // 15 seconds (aggressive refresh)
  enableCache: true,
  minLiquidity: 50000n, // Only consider liquid pools
});

// Pre-load pools
await router.refreshPools();
```

## Error Handling

```typescript
import { RouterError, RouterErrorCode } from '@astroswap/sdk';

try {
  const route = await router.findBestRoute(
    'CUSDC_ADDRESS',
    'CXLM_ADDRESS',
    1000_0000000n
  );

  if (!route) {
    console.log('No route found between tokens');
    return;
  }

  // Use route...

} catch (error) {
  if (error instanceof RouterError) {
    switch (error.code) {
      case RouterErrorCode.NoRouteFound:
        console.log('No liquidity path available');
        break;

      case RouterErrorCode.InsufficientLiquidity:
        console.log('Pool liquidity too low for trade');
        break;

      case RouterErrorCode.InvalidTokenPair:
        console.log('Invalid token addresses');
        break;

      default:
        console.error('Router error:', error.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Helper Functions

### Format Output

```typescript
import { fromContractAmount } from '@astroswap/sdk';

const route = await router.findBestRoute('USDC', 'XLM', 1000_0000000n);

if (route) {
  // Format output for display (assuming 7 decimals)
  const outputFormatted = fromContractAmount(route.expectedOutput, 7);
  console.log(`You will receive ${outputFormatted} XLM`);
}
```

### Calculate Minimum Output with Slippage

```typescript
import { withSlippage } from '@astroswap/sdk';

const route = await router.findBestRoute('USDC', 'XLM', 1000_0000000n);

if (route) {
  // 1% slippage tolerance (100 bps)
  const minOutput = withSlippage(route.expectedOutput, 100);
  console.log('Minimum output:', minOutput);

  // Use minOutput as amountOutMin in router contract call
}
```

### Check if Route is Good

```typescript
const route = await router.findBestRoute('USDC', 'XLM', 1000_0000000n);

if (route) {
  // Check price impact
  if (route.priceImpactBps > 100) { // >1%
    console.warn('High price impact!');
  }

  // Check number of hops
  if (route.pools.length > 2) {
    console.warn('Many hops - higher gas cost');
  }

  // Check quality score
  if (route.score < 0.9) {
    console.warn('Low quality route');
  }
}
```

## Real-World Example: Swap UI

```typescript
async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippageBps: number = 50 // 0.5% default
) {
  try {
    // Convert to contract amount
    const amountInBigInt = toContractAmount(amountIn, 7);

    // Find best route
    const route = await router.findBestRoute(
      tokenIn,
      tokenOut,
      amountInBigInt
    );

    if (!route) {
      return {
        success: false,
        error: 'No route available',
      };
    }

    // Get detailed quote
    const quote = await router.getRouteQuote(route, amountInBigInt);

    // Calculate minimum output with slippage
    const minOutput = withSlippage(quote.amountOut, slippageBps);

    // Format for UI
    return {
      success: true,
      route: route.path,
      amountOut: fromContractAmount(quote.amountOut, 7),
      minAmountOut: fromContractAmount(minOutput, 7),
      priceImpact: (route.priceImpactBps / 100).toFixed(2) + '%',
      hops: route.pools.length,
      pools: route.pools,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Usage in UI
const quote = await getSwapQuote('CUSDC', 'CXLM', '100', 50);

if (quote.success) {
  console.log('Route:', quote.route.join(' -> '));
  console.log('Output:', quote.amountOut);
  console.log('Min output:', quote.minAmountOut);
  console.log('Price impact:', quote.priceImpact);
}
```

## Testing Your Integration

```typescript
// 1. Test basic routing
console.log('Testing basic routing...');
const route = await router.findBestRoute(
  'USDC_ADDRESS',
  'XLM_ADDRESS',
  1000_0000000n
);
console.log('✓ Route found:', route?.path.join(' -> '));

// 2. Test split routing
console.log('\nTesting split routing...');
const split = await router.findOptimalSplit(
  'USDC_ADDRESS',
  'XLM_ADDRESS',
  50000_0000000n,
  3
);
console.log('✓ Split across', split.routes.length, 'routes');

// 3. Test cache
console.log('\nTesting cache...');
await router.refreshPools();
const stats = router.getStats();
console.log('✓ Cached', stats.cachedPools, 'pools');

// 4. Test error handling
console.log('\nTesting error handling...');
try {
  await router.findBestRoute('USDC', 'USDC', 1000n);
} catch (error) {
  console.log('✓ Error caught:', error.message);
}

console.log('\n✓ All tests passed!');
```

## Next Steps

1. **Read the full documentation**: See [ROUTER_SDK.md](./ROUTER_SDK.md)
2. **Check examples**: See [examples/router-example.ts](./examples/router-example.ts)
3. **Run tests**: `npm test router`
4. **Integrate with contracts**: Use routes with RouterClient for execution

## Support

- Documentation: [ROUTER_SDK.md](./ROUTER_SDK.md)
- Examples: [examples/router-example.ts](./examples/router-example.ts)
- Tests: [src/router/__tests__/](./src/router/__tests__/)
- Issues: GitHub Issues

## License

MIT
