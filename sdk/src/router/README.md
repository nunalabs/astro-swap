# AstroSwap Router SDK

Optimal path-finding and route optimization for multi-hop swaps on AstroSwap DEX.

## Features

- **Multi-hop Routing**: Find optimal paths through up to 5 hops
- **Split Routing**: Distribute trades across multiple routes to minimize price impact
- **Pool Caching**: Efficient caching with configurable TTL
- **Price Impact Calculation**: Accurate price impact estimation for each route
- **Route Scoring**: Intelligent route ranking based on output, price impact, and complexity

## Installation

```bash
npm install @astroswap/sdk
```

## Quick Start

```typescript
import { AstroSwapRouter, NETWORKS } from '@astroswap/sdk';

// Create router instance
const router = new AstroSwapRouter({
  factoryAddress: 'CDKZ4GWKTYA5SAW3MWEOSFCFXVPKATWXVZE2YKC3ADRN2O37Y5QTCAB3',
  network: NETWORKS.testnet,
  maxHops: 3,
  maxSplits: 3,
  poolCacheTTL: 30000, // 30 seconds
});

// Find best single route
const route = await router.findBestRoute(
  'CUSDC...', // USDC
  'CXLM...',  // XLM
  1000000000n // 1000 USDC (7 decimals)
);

console.log(`Best route: ${route.path.join(' -> ')}`);
console.log(`Expected output: ${route.expectedOutput}`);
console.log(`Price impact: ${route.priceImpactBps / 100}%`);
```

## API Reference

### AstroSwapRouter

#### Constructor

```typescript
new AstroSwapRouter(config: RouterConfig)
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `factoryAddress` | string | Required | Factory contract address |
| `network` | NetworkConfig | Required | Network configuration |
| `maxHops` | number | 3 | Maximum hops in a route (1-5) |
| `maxSplits` | number | 3 | Maximum splits for a trade (1-10) |
| `poolCacheTTL` | number | 30000 | Pool cache TTL in ms |
| `enableCache` | boolean | true | Enable pool caching |
| `minLiquidity` | bigint | 1000n | Minimum pool liquidity |

#### Methods

##### findBestRoute

Find the single best route between two tokens.

```typescript
async findBestRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  maxHops?: number
): Promise<Route | null>
```

**Example:**

```typescript
const route = await router.findBestRoute(
  'CUSDC...',
  'CXLM...',
  1000000000n,
  2 // max 2 hops
);

if (route) {
  console.log('Path:', route.path);
  console.log('Pools:', route.pools);
  console.log('Output:', route.expectedOutput);
  console.log('Price Impact:', route.priceImpactBps / 100, '%');
}
```

##### findAllRoutes

Find all possible routes between two tokens.

```typescript
async findAllRoutes(
  tokenIn: string,
  tokenOut: string,
  maxHops?: number
): Promise<Route[]>
```

**Example:**

```typescript
const routes = await router.findAllRoutes(
  'CUSDC...',
  'CBTC...',
  3
);

console.log(`Found ${routes.length} routes`);

for (const route of routes) {
  console.log(`${route.path.join(' -> ')}: ${route.expectedOutput}`);
}
```

##### findOptimalSplit

Find optimal distribution across multiple routes.

```typescript
async findOptimalSplit(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  maxSplits?: number
): Promise<SplitRoute>
```

**Example:**

```typescript
const split = await router.findOptimalSplit(
  'CUSDC...',
  'CXLM...',
  10000000000n, // Large trade
  3 // max 3 routes
);

console.log(`Split across ${split.routes.length} routes`);

for (let i = 0; i < split.routes.length; i++) {
  console.log(
    `Route ${i + 1}: ${split.percentages[i]}% -> ${split.routes[i].path.join(' -> ')}`
  );
}

console.log(`Total output: ${split.totalOutput}`);
console.log(`Price impact: ${split.totalPriceImpactBps / 100}%`);
console.log(
  `Better than single route: ${split.isBetterThanSingleRoute}`
);
```

##### getRouteQuote

Get detailed quote for a specific route.

```typescript
async getRouteQuote(
  route: Route,
  amountIn: bigint
): Promise<RouteQuote>
```

**Example:**

```typescript
const quote = await router.getRouteQuote(route, 1000000000n);

console.log('Hop-by-hop breakdown:');
for (const hop of quote.hops) {
  console.log(`${hop.tokenIn} -> ${hop.tokenOut}`);
  console.log(`  Amount in: ${hop.amountIn}`);
  console.log(`  Amount out: ${hop.amountOut}`);
  console.log(`  Price impact: ${hop.priceImpactBps / 100}%`);
  console.log(`  Fee: ${hop.feeBps / 100}%`);
}
```

##### refreshPools

Refresh pool cache with latest data.

```typescript
async refreshPools(forceRefresh?: boolean): Promise<void>
```

**Example:**

```typescript
// Soft refresh (only expired entries)
await router.refreshPools();

// Force refresh (all pools)
await router.refreshPools(true);
```

##### getStats

Get router statistics.

```typescript
getStats(): RouterStats
```

**Example:**

```typescript
const stats = router.getStats();

console.log('Router Statistics:');
console.log(`Cached pools: ${stats.cachedPools}`);
console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(2)}%`);
console.log(`Avg route finding time: ${stats.avgRouteFindingTime.toFixed(2)}ms`);
```

## Advanced Usage

### Custom Route Filtering

```typescript
import { Pathfinder } from '@astroswap/sdk';

// Find all routes
const routes = await router.findAllRoutes('CUSDC...', 'CXLM...');

// Filter by minimum output
const filtered = Pathfinder.filterRoutes(
  routes,
  900000000n, // min output
  500 // max price impact (5%)
);

// Get top 5 routes
const topRoutes = Pathfinder.getTopRoutes(filtered, 5);
```

### Manual Split Optimization

```typescript
import { SplitOptimizer } from '@astroswap/sdk';

const routes = await router.findAllRoutes('CUSDC...', 'CXLM...');

// Optimize with custom parameters
const result = SplitOptimizer.optimize(
  routes,
  10000000000n,
  3, // max splits
  20 // iterations
);

console.log(`Tested ${result.iterations} distributions`);
console.log(`Best split:`, result.splitRoute);
```

### Direct Pool Cache Access

```typescript
// Get cache instance
const cache = router['poolCache']; // Private access for demo

// Get all cached pools
const pools = cache.getAll();

// Get pools for specific token
const usdcPools = cache.getPoolsForToken('CUSDC...');

// Get cache statistics
const stats = cache.getStats();
console.log(`Cache size: ${stats.size}`);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

### Pathfinding Algorithms

```typescript
import { Pathfinder } from '@astroswap/sdk';

// Get token graph
const graph = await router['poolCache'].getGraph();

// Find direct route (single hop)
const directRoute = Pathfinder.findDirectRoute(
  graph,
  'CUSDC...',
  'CXLM...',
  1000000000n
);

// Custom pathfinding options
const options = {
  maxHops: 2,
  minLiquidity: 100000n,
  excludeTokens: ['CBAD...'],
  excludePools: ['CPOOLX...'],
};

const routes = Pathfinder.findAllPaths(
  graph,
  'CUSDC...',
  'CXLM...',
  options
);
```

## Types

### Route

```typescript
interface Route {
  path: string[];              // Token addresses
  pools: string[];             // Pool addresses
  expectedOutput: bigint;      // Expected output amount
  priceImpactBps: number;      // Price impact in bps
  score: number;               // Route quality score
}
```

### SplitRoute

```typescript
interface SplitRoute {
  routes: Route[];
  amounts: bigint[];
  percentages: number[];
  totalOutput: bigint;
  totalPriceImpactBps: number;
  isBetterThanSingleRoute: boolean;
}
```

### RouteQuote

```typescript
interface RouteQuote {
  route: Route;
  amountIn: bigint;
  amountOut: bigint;
  amounts: bigint[];           // Amount at each hop
  hops: HopQuote[];
  estimatedGas?: bigint;
}
```

### HopQuote

```typescript
interface HopQuote {
  pool: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  priceImpactBps: number;
  feeBps: number;
}
```

## Performance Tips

1. **Enable Caching**: Keep `enableCache: true` for production
2. **Tune TTL**: Adjust `poolCacheTTL` based on network conditions
3. **Limit Hops**: Use `maxHops: 2-3` for most cases
4. **Limit Splits**: Use `maxSplits: 2-3` for most cases
5. **Pre-load Pools**: Call `refreshPools()` before heavy usage

## Error Handling

```typescript
import { RouterError, RouterErrorCode } from '@astroswap/sdk';

try {
  const route = await router.findBestRoute(...);
} catch (error) {
  if (error instanceof RouterError) {
    switch (error.code) {
      case RouterErrorCode.NoRouteFound:
        console.log('No route available');
        break;
      case RouterErrorCode.InsufficientLiquidity:
        console.log('Not enough liquidity');
        break;
      case RouterErrorCode.InvalidTokenPair:
        console.log('Invalid tokens');
        break;
      default:
        console.error('Router error:', error.message);
    }
  }
}
```

## Algorithm Details

### Pathfinding

The router uses Depth-First Search (DFS) with backtracking to find all possible paths:

1. Start from input token
2. Explore all connected pools
3. Continue to next tokens (avoid cycles)
4. Record complete paths to output token
5. Calculate output for each path
6. Rank by quality score

### Route Scoring

Routes are scored based on:

```
score = (outputAmount / inputAmount) * impactPenalty * hopsPenalty

where:
  impactPenalty = max(0, 1 - priceImpactBps / 10000)
  hopsPenalty = 0.95 ^ (hops - 1)
```

### Split Optimization

The optimizer tests multiple distributions:

- **2 routes**: 100/0, 90/10, 80/20, ..., 50/50
- **3 routes**: 100/0/0, 70/30/0, 60/30/10, ..., 33/33/34
- **4+ routes**: Equal split + weighted variants

For large trades, can use gradient descent for fine-tuning.

## License

MIT
