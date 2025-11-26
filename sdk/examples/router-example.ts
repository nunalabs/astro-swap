/**
 * AstroSwap Router SDK Examples
 *
 * Demonstrates how to use the Router SDK for optimal path-finding
 */

import {
  AstroSwapRouter,
  NETWORKS,
  Pathfinder,
  SplitOptimizer,
  fromContractAmount,
} from '../src';

// Token addresses (example)
const USDC = 'CUSDC_ADDRESS_HERE';
const XLM = 'CXLM_ADDRESS_HERE';
const BTC = 'CBTC_ADDRESS_HERE';
const ETH = 'CETH_ADDRESS_HERE';

// Factory address
const FACTORY_ADDRESS = 'CFACTORY_ADDRESS_HERE';

/**
 * Example 1: Basic Route Finding
 */
async function example1_BasicRouteFinding() {
  console.log('=== Example 1: Basic Route Finding ===\n');

  // Create router
  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
    maxHops: 3,
  });

  // Amount to swap: 1000 USDC
  const amountIn = 1000_0000000n; // 7 decimals

  // Find best route
  const route = await router.findBestRoute(USDC, XLM, amountIn);

  if (!route) {
    console.log('No route found');
    return;
  }

  console.log('Best Route Found:');
  console.log(`Path: ${route.path.join(' -> ')}`);
  console.log(`Hops: ${route.pools.length}`);
  console.log(`Expected Output: ${fromContractAmount(route.expectedOutput)} XLM`);
  console.log(`Price Impact: ${(route.priceImpactBps / 100).toFixed(2)}%`);
  console.log(`Quality Score: ${route.score.toFixed(4)}`);
  console.log();
}

/**
 * Example 2: Finding All Routes
 */
async function example2_FindAllRoutes() {
  console.log('=== Example 2: Finding All Routes ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
    maxHops: 3,
  });

  // Find all possible routes
  const routes = await router.findAllRoutes(USDC, BTC);

  console.log(`Found ${routes.length} routes:\n`);

  // Display top 5 routes
  const topRoutes = routes.slice(0, 5);

  for (let i = 0; i < topRoutes.length; i++) {
    const route = topRoutes[i];
    console.log(`Route ${i + 1}:`);
    console.log(`  Path: ${route.path.join(' -> ')}`);
    console.log(`  Hops: ${route.pools.length}`);
    console.log(`  Score: ${route.score.toFixed(4)}`);
    console.log();
  }
}

/**
 * Example 3: Detailed Route Quote
 */
async function example3_DetailedQuote() {
  console.log('=== Example 3: Detailed Route Quote ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
  });

  const amountIn = 1000_0000000n;

  // Find best route
  const route = await router.findBestRoute(USDC, XLM, amountIn);

  if (!route) {
    console.log('No route found');
    return;
  }

  // Get detailed quote
  const quote = await router.getRouteQuote(route, amountIn);

  console.log('Detailed Quote:');
  console.log(`Input: ${fromContractAmount(quote.amountIn)} USDC`);
  console.log(`Output: ${fromContractAmount(quote.amountOut)} XLM`);
  console.log('\nHop-by-hop breakdown:');

  for (let i = 0; i < quote.hops.length; i++) {
    const hop = quote.hops[i];
    console.log(`\nHop ${i + 1}:`);
    console.log(`  ${hop.tokenIn} -> ${hop.tokenOut}`);
    console.log(`  Pool: ${hop.pool}`);
    console.log(`  Amount In: ${fromContractAmount(hop.amountIn)}`);
    console.log(`  Amount Out: ${fromContractAmount(hop.amountOut)}`);
    console.log(`  Price Impact: ${(hop.priceImpactBps / 100).toFixed(2)}%`);
    console.log(`  Fee: ${(hop.feeBps / 100).toFixed(2)}%`);
  }
  console.log();
}

/**
 * Example 4: Optimal Split Routing
 */
async function example4_SplitRouting() {
  console.log('=== Example 4: Optimal Split Routing ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
    maxHops: 3,
    maxSplits: 3,
  });

  // Large trade: 100,000 USDC
  const amountIn = 100000_0000000n;

  // Find optimal split
  const split = await router.findOptimalSplit(USDC, XLM, amountIn);

  console.log(`Split across ${split.routes.length} routes:\n`);

  for (let i = 0; i < split.routes.length; i++) {
    const route = split.routes[i];
    const amount = split.amounts[i];
    const percentage = split.percentages[i];

    console.log(`Route ${i + 1} (${percentage}%):`);
    console.log(`  Path: ${route.path.join(' -> ')}`);
    console.log(`  Amount: ${fromContractAmount(amount)} USDC`);
    console.log(`  Expected Output: ${fromContractAmount(route.expectedOutput)} XLM`);
    console.log();
  }

  console.log('Summary:');
  console.log(`Total Input: ${fromContractAmount(amountIn)} USDC`);
  console.log(`Total Output: ${fromContractAmount(split.totalOutput)} XLM`);
  console.log(`Price Impact: ${(split.totalPriceImpactBps / 100).toFixed(2)}%`);
  console.log(`Better than single route: ${split.isBetterThanSingleRoute}`);
  console.log();
}

/**
 * Example 5: Comparing Single vs Split Routing
 */
async function example5_CompareSingleVsSplit() {
  console.log('=== Example 5: Single vs Split Routing ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
  });

  const amountIn = 50000_0000000n; // 50,000 USDC

  // Find best single route
  const singleRoute = await router.findBestRoute(USDC, XLM, amountIn);

  if (!singleRoute) {
    console.log('No route found');
    return;
  }

  // Find optimal split
  const splitRoute = await router.findOptimalSplit(USDC, XLM, amountIn);

  console.log('Single Route:');
  console.log(`  Path: ${singleRoute.path.join(' -> ')}`);
  console.log(`  Output: ${fromContractAmount(singleRoute.expectedOutput)} XLM`);
  console.log(`  Price Impact: ${(singleRoute.priceImpactBps / 100).toFixed(2)}%`);
  console.log();

  console.log('Split Route:');
  console.log(`  Routes: ${splitRoute.routes.length}`);
  console.log(`  Output: ${fromContractAmount(splitRoute.totalOutput)} XLM`);
  console.log(`  Price Impact: ${(splitRoute.totalPriceImpactBps / 100).toFixed(2)}%`);
  console.log();

  // Calculate improvement
  const outputImprovement =
    ((Number(splitRoute.totalOutput) - Number(singleRoute.expectedOutput)) /
      Number(singleRoute.expectedOutput)) *
    100;

  const impactReduction = singleRoute.priceImpactBps - splitRoute.totalPriceImpactBps;

  console.log('Improvement:');
  console.log(`  Output: ${outputImprovement >= 0 ? '+' : ''}${outputImprovement.toFixed(2)}%`);
  console.log(
    `  Price Impact: ${impactReduction >= 0 ? '-' : '+'}${Math.abs(impactReduction / 100).toFixed(2)}%`
  );
  console.log();
}

/**
 * Example 6: Custom Route Filtering
 */
async function example6_CustomFiltering() {
  console.log('=== Example 6: Custom Route Filtering ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
    maxHops: 4,
  });

  // Find all routes
  const allRoutes = await router.findAllRoutes(USDC, BTC);

  console.log(`Total routes found: ${allRoutes.length}\n`);

  // Filter by maximum 2 hops
  const shortRoutes = allRoutes.filter(r => r.pools.length <= 2);
  console.log(`Routes with ≤2 hops: ${shortRoutes.length}`);

  // Filter by low price impact (<1%)
  const lowImpactRoutes = Pathfinder.filterRoutes(allRoutes, undefined, 100);
  console.log(`Routes with <1% impact: ${lowImpactRoutes.length}`);

  // Get top 3 routes
  const topRoutes = Pathfinder.getTopRoutes(allRoutes, 3);
  console.log('\nTop 3 routes by score:');

  for (let i = 0; i < topRoutes.length; i++) {
    const route = topRoutes[i];
    console.log(`${i + 1}. ${route.path.join(' -> ')} (score: ${route.score.toFixed(4)})`);
  }
  console.log();
}

/**
 * Example 7: Manual Split Optimization
 */
async function example7_ManualOptimization() {
  console.log('=== Example 7: Manual Split Optimization ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
  });

  const amountIn = 100000_0000000n;

  // Find available routes
  const routes = await router.findAllRoutes(USDC, XLM);

  // Get top 3 routes
  const topRoutes = Pathfinder.getTopRoutes(routes, 3);

  console.log(`Optimizing split across ${topRoutes.length} routes:\n`);

  // Optimize with more iterations
  const result = SplitOptimizer.optimize(
    topRoutes,
    amountIn,
    3, // max splits
    20 // iterations
  );

  console.log(`Tested ${result.iterations} distributions`);
  console.log('\nOptimal split:');

  for (let i = 0; i < result.splitRoute.routes.length; i++) {
    console.log(
      `Route ${i + 1}: ${result.splitRoute.percentages[i]}% -> ${result.splitRoute.routes[i].path.join(' -> ')}`
    );
  }

  console.log(`\nTotal output: ${fromContractAmount(result.splitRoute.totalOutput)} XLM`);
  console.log(`Price impact: ${(result.splitRoute.totalPriceImpactBps / 100).toFixed(2)}%`);
  console.log();
}

/**
 * Example 8: Router Statistics
 */
async function example8_RouterStats() {
  console.log('=== Example 8: Router Statistics ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
  });

  // Perform some operations
  await router.findBestRoute(USDC, XLM, 1000_0000000n);
  await router.findBestRoute(USDC, BTC, 1000_0000000n);
  await router.findBestRoute(XLM, ETH, 1000_0000000n);

  // Get statistics
  const stats = router.getStats();

  console.log('Router Statistics:');
  console.log(`Cached pools: ${stats.cachedPools}`);
  console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(2)}%`);
  console.log(`Avg route finding time: ${stats.avgRouteFindingTime.toFixed(2)}ms`);
  console.log(`Total routes found: ${stats.totalRoutesFound}`);
  console.log();
}

/**
 * Example 9: Cache Management
 */
async function example9_CacheManagement() {
  console.log('=== Example 9: Cache Management ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
    poolCacheTTL: 10000, // 10 seconds
  });

  // Initial load
  console.log('Loading pools...');
  await router.findBestRoute(USDC, XLM, 1000_0000000n);

  let stats = router.getStats();
  console.log(`Pools cached: ${stats.cachedPools}`);
  console.log();

  // Wait and refresh
  console.log('Waiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Refreshing pools (soft)...');
  await router.refreshPools();

  stats = router.getStats();
  console.log(`Pools cached: ${stats.cachedPools}`);
  console.log();

  // Force refresh
  console.log('Force refreshing all pools...');
  await router.refreshPools(true);

  stats = router.getStats();
  console.log(`Pools cached: ${stats.cachedPools}`);
  console.log();

  // Clear cache
  console.log('Clearing cache...');
  router.clearCache();

  stats = router.getStats();
  console.log(`Pools cached: ${stats.cachedPools}`);
  console.log();
}

/**
 * Example 10: Error Handling
 */
async function example10_ErrorHandling() {
  console.log('=== Example 10: Error Handling ===\n');

  const router = new AstroSwapRouter({
    factoryAddress: FACTORY_ADDRESS,
    network: NETWORKS.testnet,
  });

  // Try to find route with same input/output
  try {
    await router.findBestRoute(USDC, USDC, 1000_0000000n);
  } catch (error: any) {
    console.log('Expected error (same token):');
    console.log(`  Code: ${error.code}`);
    console.log(`  Message: ${error.message}`);
    console.log();
  }

  // Try to find route with non-existent token
  try {
    await router.findBestRoute(USDC, 'CINVALID...', 1000_0000000n);
  } catch (error: any) {
    console.log('Expected error (invalid token):');
    console.log(`  Code: ${error.code}`);
    console.log(`  Message: ${error.message}`);
    console.log();
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_BasicRouteFinding();
    await example2_FindAllRoutes();
    await example3_DetailedQuote();
    await example4_SplitRouting();
    await example5_CompareSingleVsSplit();
    await example6_CustomFiltering();
    await example7_ManualOptimization();
    await example8_RouterStats();
    await example9_CacheManagement();
    await example10_ErrorHandling();

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export examples for individual use
export {
  example1_BasicRouteFinding,
  example2_FindAllRoutes,
  example3_DetailedQuote,
  example4_SplitRouting,
  example5_CompareSingleVsSplit,
  example6_CustomFiltering,
  example7_ManualOptimization,
  example8_RouterStats,
  example9_CacheManagement,
  example10_ErrorHandling,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
