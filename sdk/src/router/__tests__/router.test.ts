/**
 * Router Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AstroSwapRouter } from '../index';
import { PoolCache } from '../pool-cache';
import { Pathfinder } from '../pathfinder';
import { SplitOptimizer } from '../split-optimizer';
import type { PoolData, Route } from '../types';
import { NETWORKS } from '../../types';

// Mock pool data
const mockPools: PoolData[] = [
  {
    address: 'POOL_USDC_XLM',
    token0: 'USDC',
    token1: 'XLM',
    reserve0: 1000000_0000000n,
    reserve1: 500000_0000000n,
    feeBps: 30,
    cachedAt: Date.now(),
  },
  {
    address: 'POOL_XLM_BTC',
    token0: 'XLM',
    token1: 'BTC',
    reserve0: 500000_0000000n,
    reserve1: 10_0000000n,
    feeBps: 30,
    cachedAt: Date.now(),
  },
  {
    address: 'POOL_USDC_BTC',
    token0: 'USDC',
    token1: 'BTC',
    reserve0: 1000000_0000000n,
    reserve1: 10_0000000n,
    feeBps: 30,
    cachedAt: Date.now(),
  },
  {
    address: 'POOL_BTC_ETH',
    token0: 'BTC',
    token1: 'ETH',
    reserve0: 10_0000000n,
    reserve1: 150_0000000n,
    feeBps: 30,
    cachedAt: Date.now(),
  },
];

describe('PoolCache', () => {
  let cache: PoolCache;

  beforeEach(() => {
    cache = new PoolCache(30000);
  });

  it('should set and get pool data', () => {
    const pool = mockPools[0];
    cache.set(pool.address, pool);

    const retrieved = cache.get(pool.address);
    expect(retrieved).toBeDefined();
    expect(retrieved?.address).toBe(pool.address.toLowerCase());
  });

  it('should set multiple pools', () => {
    cache.setMany(mockPools);

    const stats = cache.getStats();
    expect(stats.size).toBe(mockPools.length);
  });

  it('should return null for non-existent pool', () => {
    const retrieved = cache.get('NON_EXISTENT');
    expect(retrieved).toBeNull();
  });

  it('should build token graph', () => {
    cache.setMany(mockPools);

    const graph = cache.getGraph();
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.pools.length).toBe(mockPools.length);
  });

  it('should get pools for token', () => {
    cache.setMany(mockPools);

    const usdcPools = cache.getPoolsForToken('USDC');
    expect(usdcPools.length).toBe(2); // USDC-XLM and USDC-BTC
  });

  it('should track hit rate', () => {
    const pool = mockPools[0];
    cache.set(pool.address, pool);

    // Hit
    cache.get(pool.address);
    // Miss
    cache.get('NON_EXISTENT');

    const hitRate = cache.getHitRate();
    expect(hitRate).toBe(0.5); // 1 hit, 1 miss
  });

  it('should clean expired entries', async () => {
    const shortCache = new PoolCache(100); // 100ms TTL
    shortCache.setMany(mockPools);

    expect(shortCache.getStats().size).toBe(mockPools.length);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    const cleaned = shortCache.cleanExpired();
    expect(cleaned).toBe(mockPools.length);
    expect(shortCache.getStats().size).toBe(0);
  });

  it('should handle case-insensitive addresses', () => {
    const pool = mockPools[0];
    cache.set(pool.address.toUpperCase(), pool);

    const retrieved = cache.get(pool.address.toLowerCase());
    expect(retrieved).toBeDefined();
  });
});

describe('Pathfinder', () => {
  let cache: PoolCache;

  beforeEach(() => {
    cache = new PoolCache(30000);
    cache.setMany(mockPools);
  });

  it('should find direct route', () => {
    const graph = cache.getGraph();
    const route = Pathfinder.findDirectRoute(graph, 'USDC', 'XLM', 1000_0000000n);

    expect(route).toBeDefined();
    expect(route?.path).toEqual(['USDC', 'XLM']);
    expect(route?.pools).toHaveLength(1);
  });

  it('should find multi-hop route', () => {
    const graph = cache.getGraph();
    const paths = Pathfinder.findAllPaths(graph, 'USDC', 'BTC', {
      maxHops: 3,
    });

    expect(paths.length).toBeGreaterThan(0);

    // Should find direct route (USDC -> BTC)
    const directPath = paths.find(p => p.tokens.length === 2);
    expect(directPath).toBeDefined();

    // Should find 2-hop route (USDC -> XLM -> BTC)
    const twoHopPath = paths.find(p => p.tokens.length === 3);
    expect(twoHopPath).toBeDefined();
  });

  it('should find best path based on output', () => {
    const graph = cache.getGraph();
    const route = Pathfinder.findBestPath(graph, 'USDC', 'BTC', 1000_0000000n, {
      maxHops: 3,
    });

    expect(route).toBeDefined();
    expect(route?.expectedOutput).toBeGreaterThan(0n);
  });

  it('should throw error for same input/output token', () => {
    const graph = cache.getGraph();

    expect(() => {
      Pathfinder.findAllPaths(graph, 'USDC', 'USDC', { maxHops: 3 });
    }).toThrow();
  });

  it('should throw error for non-existent token', () => {
    const graph = cache.getGraph();

    expect(() => {
      Pathfinder.findAllPaths(graph, 'USDC', 'NON_EXISTENT', { maxHops: 3 });
    }).toThrow();
  });

  it('should calculate route correctly', () => {
    const path = {
      tokens: ['USDC', 'XLM'],
      pools: [mockPools[0]],
    };

    const route = Pathfinder.calculateRoute(path, 1000_0000000n);

    expect(route).toBeDefined();
    expect(route?.expectedOutput).toBeGreaterThan(0n);
    expect(route?.priceImpactBps).toBeGreaterThanOrEqual(0);
    expect(route?.score).toBeGreaterThan(0);
  });

  it('should filter routes by minimum output', () => {
    const routes: Route[] = [
      {
        path: ['USDC', 'XLM'],
        pools: ['POOL1'],
        expectedOutput: 1000n,
        priceImpactBps: 50,
        score: 1.0,
      },
      {
        path: ['USDC', 'BTC'],
        pools: ['POOL2'],
        expectedOutput: 2000n,
        priceImpactBps: 30,
        score: 1.5,
      },
    ];

    const filtered = Pathfinder.filterRoutes(routes, 1500n);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].expectedOutput).toBeGreaterThanOrEqual(1500n);
  });

  it('should filter routes by max price impact', () => {
    const routes: Route[] = [
      {
        path: ['USDC', 'XLM'],
        pools: ['POOL1'],
        expectedOutput: 1000n,
        priceImpactBps: 50,
        score: 1.0,
      },
      {
        path: ['USDC', 'BTC'],
        pools: ['POOL2'],
        expectedOutput: 2000n,
        priceImpactBps: 30,
        score: 1.5,
      },
    ];

    const filtered = Pathfinder.filterRoutes(routes, undefined, 40);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].priceImpactBps).toBeLessThanOrEqual(40);
  });

  it('should sort routes by score', () => {
    const routes: Route[] = [
      {
        path: ['A', 'B'],
        pools: ['P1'],
        expectedOutput: 1000n,
        priceImpactBps: 50,
        score: 1.0,
      },
      {
        path: ['A', 'C'],
        pools: ['P2'],
        expectedOutput: 2000n,
        priceImpactBps: 30,
        score: 2.0,
      },
      {
        path: ['A', 'D'],
        pools: ['P3'],
        expectedOutput: 1500n,
        priceImpactBps: 40,
        score: 1.5,
      },
    ];

    const sorted = Pathfinder.sortRoutes(routes);
    expect(sorted[0].score).toBe(2.0);
    expect(sorted[1].score).toBe(1.5);
    expect(sorted[2].score).toBe(1.0);
  });

  it('should get top N routes', () => {
    const routes: Route[] = Array.from({ length: 10 }, (_, i) => ({
      path: ['A', 'B'],
      pools: ['P1'],
      expectedOutput: BigInt(i * 100),
      priceImpactBps: i * 10,
      score: i,
    }));

    const top3 = Pathfinder.getTopRoutes(routes, 3);
    expect(top3).toHaveLength(3);
    expect(top3[0].score).toBeGreaterThan(top3[1].score);
    expect(top3[1].score).toBeGreaterThan(top3[2].score);
  });
});

describe('SplitOptimizer', () => {
  const mockRoutes: Route[] = [
    {
      path: ['USDC', 'XLM'],
      pools: ['POOL1'],
      expectedOutput: 1000_0000000n,
      priceImpactBps: 100,
      score: 1.5,
    },
    {
      path: ['USDC', 'BTC', 'XLM'],
      pools: ['POOL2', 'POOL3'],
      expectedOutput: 950_0000000n,
      priceImpactBps: 50,
      score: 1.3,
    },
    {
      path: ['USDC', 'ETH', 'XLM'],
      pools: ['POOL4', 'POOL5'],
      expectedOutput: 900_0000000n,
      priceImpactBps: 30,
      score: 1.1,
    },
  ];

  it('should create single route split for one route', () => {
    const split = SplitOptimizer.findOptimalSplit([mockRoutes[0]], 1000_0000000n, 1);

    expect(split.routes).toHaveLength(1);
    expect(split.percentages).toEqual([100]);
    expect(split.amounts[0]).toBe(1000_0000000n);
  });

  it('should find optimal split for two routes', () => {
    const split = SplitOptimizer.findOptimalSplit(
      [mockRoutes[0], mockRoutes[1]],
      1000_0000000n,
      2
    );

    expect(split.routes.length).toBeGreaterThan(0);
    expect(split.routes.length).toBeLessThanOrEqual(2);

    // Percentages should sum to 100
    const sum = split.percentages.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.01);
  });

  it('should find optimal split for three routes', () => {
    const split = SplitOptimizer.findOptimalSplit(mockRoutes, 1000_0000000n, 3);

    expect(split.routes.length).toBeGreaterThan(0);
    expect(split.routes.length).toBeLessThanOrEqual(3);

    // Percentages should sum to 100
    const sum = split.percentages.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.01);
  });

  it('should optimize split with iterations', () => {
    const result = SplitOptimizer.optimize(mockRoutes, 1000_0000000n, 3, 10);

    expect(result.splitRoute.routes.length).toBeGreaterThan(0);
    expect(result.testedDistributions.length).toBeGreaterThan(0);
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('should compare split vs single route', () => {
    const singleRoute = mockRoutes[0];
    const splitRoute = SplitOptimizer.findOptimalSplit(mockRoutes, 1000_0000000n, 3);

    const isBetter = SplitOptimizer.isSplitBetter(splitRoute, singleRoute);
    expect(typeof isBetter).toBe('boolean');
  });

  it('should handle zero amount gracefully', () => {
    const split = SplitOptimizer.findOptimalSplit(mockRoutes, 0n, 3);

    expect(split.routes).toBeDefined();
    expect(split.totalOutput).toBe(0n);
  });
});

describe('AstroSwapRouter Integration', () => {
  // Note: These tests would require mocking the contract clients
  // or running against a test network

  // Valid test contract ID (properly formatted Stellar contract address)
  const TEST_FACTORY_ADDRESS =
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

  it('should initialize with valid config', () => {
    const router = new AstroSwapRouter({
      factoryAddress: TEST_FACTORY_ADDRESS,
      network: NETWORKS.testnet,
    });

    expect(router).toBeDefined();
  });

  it('should throw error for invalid config', () => {
    expect(() => {
      new AstroSwapRouter({
        factoryAddress: '',
        network: NETWORKS.testnet,
      });
    }).toThrow();
  });

  it('should throw error for invalid maxHops', () => {
    expect(() => {
      new AstroSwapRouter({
        factoryAddress: TEST_FACTORY_ADDRESS,
        network: NETWORKS.testnet,
        maxHops: 10, // Too high
      });
    }).toThrow();
  });

  it('should clear cache', () => {
    const router = new AstroSwapRouter({
      factoryAddress: TEST_FACTORY_ADDRESS,
      network: NETWORKS.testnet,
    });

    router.clearCache();

    const stats = router.getStats();
    expect(stats.cachedPools).toBe(0);
  });

  it('should get stats', () => {
    const router = new AstroSwapRouter({
      factoryAddress: TEST_FACTORY_ADDRESS,
      network: NETWORKS.testnet,
    });

    const stats = router.getStats();

    expect(stats).toHaveProperty('cachedPools');
    expect(stats).toHaveProperty('cacheHitRate');
    expect(stats).toHaveProperty('avgRouteFindingTime');
    expect(stats).toHaveProperty('totalRoutesFound');
  });
});
