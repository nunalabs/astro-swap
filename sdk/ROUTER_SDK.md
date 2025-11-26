# AstroSwap Router SDK

## Overview

The AstroSwap Router SDK is a professional-grade, optimal path-finding solution for the AstroSwap DEX on Stellar/Soroban. It implements advanced routing algorithms to find the best swap routes and optimize trade execution across multiple paths.

## Architecture

```
router/
├── types.ts              # TypeScript type definitions
├── pool-cache.ts         # Efficient pool data caching
├── pathfinder.ts         # DFS-based path finding
├── split-optimizer.ts    # Multi-route optimization
├── index.ts              # Main Router class
└── __tests__/            # Comprehensive tests
    └── router.test.ts
```

## Key Features

### 1. Multi-Hop Routing
- **DFS Algorithm**: Depth-First Search with backtracking
- **Configurable Hops**: Support for 1-5 hops
- **Cycle Detection**: Prevents infinite loops
- **Quality Scoring**: Ranks routes by output, price impact, and complexity

### 2. Split Routing
- **Multi-Route Distribution**: Split trades across 2-10 routes
- **Price Impact Reduction**: Minimize slippage on large trades
- **Distribution Testing**: Tests multiple allocation strategies
- **Gradient Descent**: Optional fine-tuning optimization

### 3. Pool Caching
- **TTL-Based Expiration**: Configurable time-to-live
- **Token Graph**: Efficient graph structure for pathfinding
- **Hit Rate Tracking**: Monitor cache performance
- **Lazy Refresh**: Only update expired entries

### 4. Route Optimization
- **Score-Based Ranking**: Multi-factor quality assessment
- **Price Impact Calculation**: Accurate per-hop impact
- **Output Maximization**: Find highest output routes
- **Filtering**: By minimum output, max impact, etc.

## Core Classes

### AstroSwapRouter

Main router class providing all routing functionality.

**Methods:**
- `findBestRoute()` - Find single best route
- `findAllRoutes()` - Find all possible routes
- `findOptimalSplit()` - Find optimal multi-route split
- `getRouteQuote()` - Get detailed quote for a route
- `getSplitQuote()` - Get detailed quote for split route
- `refreshPools()` - Refresh pool cache
- `getStats()` - Get router statistics
- `clearCache()` - Clear all cached data

### PoolCache

Efficient caching layer for pool data.

**Methods:**
- `get()` - Get pool by address
- `set()` - Set pool data
- `setMany()` - Set multiple pools
- `getAll()` - Get all non-expired pools
- `getPoolsForToken()` - Get pools for specific token
- `getGraph()` - Get token graph
- `getStats()` - Get cache statistics
- `cleanExpired()` - Remove expired entries

### Pathfinder

Path-finding algorithms.

**Static Methods:**
- `findAllPaths()` - Find all paths between tokens
- `findBestPath()` - Find best single path
- `findDirectRoute()` - Find direct (1-hop) route
- `calculateRoute()` - Calculate route details
- `filterRoutes()` - Filter by criteria
- `sortRoutes()` - Sort by quality
- `getTopRoutes()` - Get top N routes

### SplitOptimizer

Trade splitting optimization.

**Static Methods:**
- `findOptimalSplit()` - Find optimal distribution
- `optimize()` - Gradient descent optimization
- `isSplitBetter()` - Compare split vs single route

## Algorithms

### 1. Pathfinding Algorithm

**DFS with Backtracking:**

```
1. Start from tokenIn
2. Mark current token as visited
3. For each connected pool:
   a. Skip if pool excluded or insufficient liquidity
   b. Get next token
   c. Skip if visited or excluded
   d. If next token is tokenOut, record path
   e. Else if depth < maxHops, recurse
4. Unmark current token (backtrack)
5. Return all found paths
```

**Complexity:**
- Time: O(n^h) where n = pools, h = maxHops
- Space: O(h) for recursion stack

### 2. Route Scoring

Routes are scored using a multi-factor formula:

```typescript
score = (outputAmount / inputAmount) * impactPenalty * hopsPenalty

where:
  impactPenalty = max(0, 1 - priceImpactBps / 10000)
  hopsPenalty = 0.95 ^ (hops - 1)
```

**Factors:**
- **Output Ratio**: Higher output is better
- **Price Impact**: Lower impact is better
- **Hop Count**: Fewer hops is better

### 3. Split Optimization

**Distribution Testing:**

For 2 routes:
```
[100, 0], [90, 10], [80, 20], ..., [50, 50], [40, 60], ..., [0, 100]
```

For 3 routes:
```
[100, 0, 0], [80, 20, 0], [70, 30, 0], [60, 40, 0],
[70, 15, 15], [60, 20, 20], [50, 25, 25], [34, 33, 33], ...
```

**Gradient Descent (Optional):**
```
1. Start with equal distribution
2. Generate neighbor distributions (+/- 5%)
3. Evaluate each neighbor
4. Move to best neighbor
5. Repeat until no improvement
```

### 4. Output Calculation

For each hop in a route:

```typescript
// Constant Product Formula (x * y = k)
amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee)

where:
  amountInWithFee = amountIn * (10000 - feeBps) / 10000
```

Multi-hop output:
```
output[0] = amountIn
output[i+1] = calculateHop(output[i], pool[i])
finalOutput = output[n]
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `findBestRoute` | O(n^h + p*h) | n=pools, h=hops, p=paths |
| `findAllRoutes` | O(n^h) | Exponential in hops |
| `findOptimalSplit` | O(p*d) | p=paths, d=distributions |
| `optimize` | O(p*d*i) | i=iterations |
| Cache lookup | O(1) | Hash map |
| Cache refresh | O(n) | n=pools |

### Space Complexity

| Component | Complexity | Notes |
|-----------|------------|-------|
| Pool cache | O(n) | n=pools |
| Token graph | O(n+e) | e=edges (pools) |
| Route storage | O(p*h) | p=paths, h=hops |
| Recursion stack | O(h) | h=max hops |

### Optimization Tips

1. **Cache Configuration**:
   - Use `poolCacheTTL: 30000` (30s) for production
   - Enable caching: `enableCache: true`
   - Pre-load pools before heavy usage

2. **Hop Limits**:
   - Use `maxHops: 2-3` for most cases
   - Limit to 2 hops for best performance
   - Only use 4-5 hops for exotic pairs

3. **Split Limits**:
   - Use `maxSplits: 2-3` for most cases
   - Only increase for very large trades
   - Consider gas costs vs benefits

4. **Filtering**:
   - Set `minLiquidity` to filter small pools
   - Use `excludeTokens` for known bad tokens
   - Use `excludePools` for problematic pools

## Usage Examples

### Basic Route Finding

```typescript
const router = new AstroSwapRouter({
  factoryAddress: 'CXXX...',
  network: NETWORKS.testnet,
  maxHops: 3,
});

const route = await router.findBestRoute(
  'USDC',
  'XLM',
  1000_0000000n
);

console.log(`Route: ${route.path.join(' -> ')}`);
console.log(`Output: ${route.expectedOutput}`);
console.log(`Impact: ${route.priceImpactBps / 100}%`);
```

### Split Routing

```typescript
const split = await router.findOptimalSplit(
  'USDC',
  'XLM',
  100000_0000000n, // Large trade
  3 // max 3 routes
);

for (let i = 0; i < split.routes.length; i++) {
  console.log(
    `Route ${i + 1}: ${split.percentages[i]}% -> ${split.routes[i].path.join(' -> ')}`
  );
}

console.log(`Total output: ${split.totalOutput}`);
console.log(`Better than single: ${split.isBetterThanSingleRoute}`);
```

### Detailed Quotes

```typescript
const quote = await router.getRouteQuote(route, amountIn);

for (const hop of quote.hops) {
  console.log(`${hop.tokenIn} -> ${hop.tokenOut}`);
  console.log(`  In: ${hop.amountIn}`);
  console.log(`  Out: ${hop.amountOut}`);
  console.log(`  Impact: ${hop.priceImpactBps / 100}%`);
}
```

## Configuration Reference

### RouterConfig

```typescript
interface RouterConfig {
  factoryAddress: string;     // Required: Factory contract
  network: NetworkConfig;      // Required: Network config
  maxHops?: number;            // Default: 3 (1-5)
  maxSplits?: number;          // Default: 3 (1-10)
  poolCacheTTL?: number;       // Default: 30000ms
  enableCache?: boolean;       // Default: true
  minLiquidity?: bigint;       // Default: 1000n
}
```

### PathSearchOptions

```typescript
interface PathSearchOptions {
  maxHops: number;
  minLiquidity?: bigint;
  excludePools?: string[];
  excludeTokens?: string[];
}
```

## Type Reference

### Route

```typescript
interface Route {
  path: string[];           // Token addresses
  pools: string[];          // Pool addresses
  expectedOutput: bigint;   // Expected output
  priceImpactBps: number;   // Price impact (bps)
  score: number;            // Quality score
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
  amounts: bigint[];
  hops: HopQuote[];
  estimatedGas?: bigint;
}
```

## Error Handling

### RouterError

```typescript
enum RouterErrorCode {
  NoRouteFound = 'NO_ROUTE_FOUND',
  InvalidTokenPair = 'INVALID_TOKEN_PAIR',
  InsufficientLiquidity = 'INSUFFICIENT_LIQUIDITY',
  InvalidPath = 'INVALID_PATH',
  CacheError = 'CACHE_ERROR',
  InvalidConfiguration = 'INVALID_CONFIGURATION',
  OptimizationFailed = 'OPTIMIZATION_FAILED',
}
```

Example:
```typescript
try {
  const route = await router.findBestRoute(...);
} catch (error) {
  if (error instanceof RouterError) {
    console.log(`Error: ${error.code} - ${error.message}`);
  }
}
```

## Testing

Run tests:
```bash
npm test router
```

Test coverage:
```bash
npm run test:coverage
```

## Performance Benchmarks

Typical performance on testnet:

| Operation | Time | Memory |
|-----------|------|--------|
| Pool cache load (100 pools) | ~500ms | ~50KB |
| Find best route (3 hops) | ~10ms | ~1KB |
| Find all routes (3 hops) | ~50ms | ~10KB |
| Optimal split (3 routes) | ~30ms | ~5KB |
| Cache hit | ~0.1ms | - |
| Cache miss | ~200ms | - |

## Best Practices

1. **Initialize Once**: Create router instance once and reuse
2. **Pre-load Pools**: Call `refreshPools()` during initialization
3. **Monitor Cache**: Check `getStats()` for cache performance
4. **Handle Errors**: Always catch and handle RouterError
5. **Limit Hops**: Use 2-3 hops for 99% of cases
6. **Large Trades**: Use split routing for trades >10k USD
7. **Gas Estimation**: Consider gas costs for multi-hop routes

## Future Enhancements

- [ ] Multi-protocol routing (Soroswap, Phoenix, Aqua)
- [ ] Gas cost estimation and optimization
- [ ] Historical price impact data
- [ ] Machine learning for route prediction
- [ ] Real-time pool monitoring via WebSocket
- [ ] Route simulation before execution
- [ ] MEV protection strategies

## License

MIT

## Contributing

Contributions welcome! Please see CONTRIBUTING.md for guidelines.
