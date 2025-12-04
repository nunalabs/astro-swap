---
name: sdk-patterns
description: TypeScript SDK patterns for @astroswap/sdk development.
---

# SDK Patterns Skill

## Client Architecture

```typescript
// Main SDK client
export class AstroSwap {
  private factory: FactoryContract;
  private router: RouterContract;
  private rpc: SorobanRpc.Server;

  constructor(config: AstroSwapConfig) {
    this.rpc = new SorobanRpc.Server(config.rpcUrl);
    this.factory = new FactoryContract(config.factoryId, this.rpc);
    this.router = new RouterContract(config.routerId, this.rpc);
  }

  // Public API
  async getQuote(params: QuoteParams): Promise<Quote> { ... }
  async swap(params: SwapParams, signer: Keypair): Promise<SwapResult> { ... }
  async addLiquidity(params: LiquidityParams, signer: Keypair): Promise<LiquidityResult> { ... }
}
```

## Type Definitions

```typescript
// Config
interface AstroSwapConfig {
  network: 'testnet' | 'mainnet';
  rpcUrl: string;
  factoryId: string;
  routerId: string;
}

// Quote
interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
}

interface Quote {
  amountOut: bigint;
  priceImpact: number;
  path: string[];
  fee: bigint;
}

// Swap
interface SwapParams extends QuoteParams {
  slippageBps: number;  // e.g., 50 = 0.5%
  deadline?: number;    // Unix timestamp
}

interface SwapResult {
  txHash: string;
  amountIn: bigint;
  amountOut: bigint;
  path: string[];
}
```

## Error Handling

```typescript
// Custom error hierarchy
export class AstroSwapError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AstroSwapError';
  }
}

export class PairNotFoundError extends AstroSwapError {
  constructor(public tokenA: string, public tokenB: string) {
    super(`Pair not found: ${tokenA}/${tokenB}`, 'PAIR_NOT_FOUND');
  }
}

export class InsufficientLiquidityError extends AstroSwapError {
  constructor(public requested: bigint, public available: bigint) {
    super(`Insufficient liquidity`, 'INSUFFICIENT_LIQUIDITY');
  }
}

export class SlippageExceededError extends AstroSwapError {
  constructor(public expected: bigint, public actual: bigint) {
    super(`Slippage exceeded: expected ${expected}, got ${actual}`, 'SLIPPAGE_EXCEEDED');
  }
}
```

## Contract Bindings

```typescript
// Factory contract
class FactoryContract {
  constructor(
    private contractId: string,
    private rpc: SorobanRpc.Server,
  ) {}

  async getPair(tokenA: string, tokenB: string): Promise<string | null> {
    const contract = new Contract(this.contractId);
    const result = await this.rpc.simulateTransaction(
      new TransactionBuilder(...)
        .addOperation(contract.call('get_pair', tokenA, tokenB))
        .build()
    );
    return this.parseResult(result);
  }

  async allPairs(): Promise<string[]> { ... }
}

// Pair contract
class PairContract {
  async getReserves(): Promise<[bigint, bigint]> { ... }
  async swap(params: SwapParams, signer: Keypair): Promise<SwapResult> { ... }
}
```

## Transaction Building

```typescript
async function buildSwapTx(
  router: string,
  params: SwapParams,
  source: string,
): Promise<Transaction> {
  const contract = new Contract(router);

  const tx = new TransactionBuilder(await server.getAccount(source), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        'swap_exact_tokens_for_tokens',
        nativeToScVal(params.amountIn, { type: 'i128' }),
        nativeToScVal(params.minAmountOut, { type: 'i128' }),
        nativeToScVal(params.path, { type: 'Vec' }),
        nativeToScVal(params.to, { type: 'Address' }),
        nativeToScVal(params.deadline, { type: 'u64' }),
      )
    )
    .setTimeout(30)
    .build();

  return tx;
}
```

## Testing Patterns

```typescript
describe('AstroSwap SDK', () => {
  let sdk: AstroSwap;

  beforeAll(() => {
    sdk = new AstroSwap({
      network: 'testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      factoryId: 'CFACTORY...',
      routerId: 'CROUTER...',
    });
  });

  describe('getQuote', () => {
    it('returns accurate quote', async () => {
      const quote = await sdk.getQuote({
        tokenIn: XLM,
        tokenOut: USDC,
        amountIn: 100_0000000n,
      });

      expect(quote.amountOut).toBeGreaterThan(0n);
      expect(quote.priceImpact).toBeLessThan(1);
    });
  });
});
```

## Utility Functions

```typescript
// Amount formatting
export function formatAmount(amount: bigint, decimals = 7): string {
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

// Slippage calculation
export function calculateMinOutput(amount: bigint, slippageBps: number): bigint {
  return amount - (amount * BigInt(slippageBps) / 10000n);
}

// Deadline
export function getDeadline(minutes = 20): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}
```
