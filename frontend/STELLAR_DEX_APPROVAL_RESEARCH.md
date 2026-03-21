# Stellar/Soroban DEX Token Approval Research

Investigación exhaustiva de cómo otros proyectos production-ready en Stellar/Soroban manejan token approvals.

## Fecha

2026-03-17

---

## 🎯 Hallazgos Clave

### 1. Best Practice Crítico (Stellar Official Docs)

**Problema**: Race condition en `approve()` function

> "The approve function overwrites the previous value with amount, so it is possible for the previous allowance to be spent in an earlier transaction before amount is written in a later transaction, which means the spender can spend more than intended."

**Solución Recomendada**:
1. Set allowance to 0
2. Verify that spender didn't spend any portion of the previous allowance
3. Set allowance to the new desired amount

**Fuente**: [Stellar Token Interface Documentation](https://developers.stellar.org/docs/tokens/token-interface)

**Issue Original**: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

### 2. Stellar Official Example DApp

**Repo**: [stellar/soroban-example-dapp](https://github.com/stellar/soroban-example-dapp)

**Issue Reportado**: [Issue #13 - Authorize the token.approve contract call](https://github.com/stellar/soroban-example-dapp/issues/13)

**Problema Identificado**:
- El código tenía: `let from = account.address; // TODO: This should be a signature.`
- La transacción no se firmaba correctamente con Freighter wallet
- El approval call fallaba

**Status**:
- Issue cerrado como completed (Jun 28, 2024)
- Repo archivado (Jan 8, 2026)

**Lección Aprendida**: Approvals DEBEN tener firmas correctas de wallet, no placeholders.

---

## 📚 Proyectos Production en Stellar/Soroban

### 1. Soroswap (First DEX Aggregator on Stellar)

**URLs**:
- Website: https://soroswap.finance/
- Frontend: https://github.com/soroswap/frontend
- Core contracts: https://github.com/soroswap/core
- Documentation: https://github.com/soroswap/docs

**Tech Stack**:
- TypeScript (99.0%)
- Vitest & testing-library
- Yarn workspaces (monorepo)
- Live on Stellar Mainnet

**Approval Functions (SoroswapPair Contract)**:
```rust
fn allowance(e: Env, from: Address, spender: Address) -> i128;
fn approve(e: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32);
```

**Características**:
- Open-source AMM protocol
- AMM Aggregator on Soroban
- SDK incluido
- Easy to use frontend

**Observación**:
- El contrato implementa la interfaz completa de tokens SAC
- Incluye functions de approve/allowance standard
- 324 issues cerrados → proyecto maduro y bien mantenido

### 2. Phoenix Protocol (First DeFi Hub on Stellar)

**URLs**:
- Website: https://www.phoenix-hub.io/
- Organization: https://github.com/Phoenix-Protocol-Group
- Smart Contracts: https://github.com/Phoenix-Protocol-Group/phoenix-contracts
- Frontend: https://github.com/Phoenix-Protocol-Group/phoenix-frontend (privado/archivado)

**Historia**:
- Started building: June 2023
- Launch: May 7th, 2024
- Soporte del Stellar Community Fund (SCF)

**Tech Stack**:
- Rust (smart contracts)
- TypeScript (frontend)
- Yarn workspaces
- MUI-based UI kit

**Status**:
- Frontend repo parece estar privado o archivado
- Smart contracts públicos
- Empowered by Soroban's technology

---

## 🛠️ Frameworks y Herramientas

### @soroban-react

**URLs**:
- Documentation: https://soroban-react.gitbook.io/index
- GitHub: https://github.com/paltalabs/soroban-react

**React Hooks Disponibles**:
```typescript
// Wallet & Account
useAccount()         // Fetch user's account data
useNetwork()         // Network management
useIsMounted()       // Lifecycle utility

// Events
useSorobanEvents()   // Subscribe to contract events
```

**State Management**:
- Global context accessible throughout dApp
- Contains: current account, chain info
- No external state management needed (built-in Context)

**Wallet Integration**:
- Freighter connector package included
- Seamless integration with Freighter/Albedo/XBull
- Access to Soroban token balances
- Secure transaction signing

**Features**:
- Custom React hooks para smart contract interaction
- Simplifica transactions en Soroban
- Event subscription support

### Stellar Official Examples

**soroban-react-payment**: https://github.com/stellar/soroban-react-payment
- Example dApp con integración de wallets
- Construye transactions que invocan transfer method
- Uses token interface

**soroban-react-mint-token**: https://github.com/stellar/soroban-react-mint-token
- Example dApp para minting tokens
- Soroban integration patterns

---

## 📖 Documentación Oficial

### Token Interface Specification

**Fuente**: [Create Contract Tokens on Stellar](https://developers.stellar.org/docs/tokens/token-interface)

#### approve() Function

**Signature**:
```rust
fn approve(
    env: Env,
    from: Address,
    spender: Address,
    amount: i128,
    expiration_ledger: u32
) -> ()
```

**Parameters**:
- `from`: Address holding the token balance
- `spender`: Address being authorized
- `amount`: Tokens made available
- `expiration_ledger`: Ledger where allowance expires (cannot be < current ledger unless amount is 0)

**Event Emitted**:
```rust
topics: ["approve", from: Address, spender: Address]
data: [amount: i128, expiration_ledger: u32]
```

**Behavior**:
- Overwrites previous allowance value
- Authorizes spender to transfer on behalf of token holder

#### allowance() Function

**Signature**:
```rust
fn allowance(env: Env, from: Address, spender: Address) -> i128
```

**Returns**: Authorized amount (i128)

**Behavior**:
- Expired allowances (expiration_ledger < current ledger) return 0
- Shows amount spender can still transfer

#### Authorization Requirements

**Critical Note from Docs**:
> "Users have to authorize the token function calls with all the arguments of the invocation."

Inconsistency puede causar:
- Wallet confusion
- Signature failures

#### Error Handling

**Pattern usado en Stellar examples**:
```rust
let current_allowance = allowance(env, from, spender);
if current_allowance < amount {
    panic!("Insufficient allowance");
}
```

**Standard**: Trapping (halts execution and reverts state changes)

### Stellar Asset Contract (SAC)

**Fuente**: [Use Issued Assets in Smart Contracts](https://developers.stellar.org/docs/tokens/stellar-asset-contract)

**Key Points**:
- SAC implementa la token interface completa
- Todos los tokens SAC tienen approve/allowance
- Built-in en Stellar, no necesita deployment separado

---

## 🔐 Security Considerations

### 1. Approval Race Condition (Critical)

**Problema**:
```
1. Alice approves Bob for 100 tokens
2. Bob spends 50 tokens
3. Alice wants to change approval to 70
4. Bob puede spent 50 + 70 = 120 tokens (si timing correcto)
```

**Solución**:
```typescript
// Step 1: Set to 0 first
await approve(token, spender, 0, expirationLedger);

// Step 2: Verify spender didn't spend
const currentAllowance = await allowance(token, owner, spender);
assert(currentAllowance === 0, "Spender spent during reset");

// Step 3: Set new amount
await approve(token, spender, newAmount, expirationLedger);
```

### 2. Allowance Overwriting Risk

- `approve()` sobrescribe valor anterior completamente
- NO es incremental
- Potential double-spending sin precauciones

### 3. Expiration Ledger Management

- `expiration_ledger` DEBE ser >= current ledger (excepto si amount = 0)
- Allowances expiradas retornan 0 automáticamente
- No cleanup manual necesario

### 4. Authorization Consistency

- TODOS los argumentos de invocation deben estar en signature
- Wallets pueden rechazar si hay inconsistencia
- User experience puede degradarse

---

## 💡 Patterns Identificados

### Pattern 1: Pre-Check Before Transaction (Común)

```typescript
// Usado por la mayoría de DEXs
const checkApprovals = async () => {
  const allowanceA = await getAllowance(tokenA, owner, router);
  const allowanceB = await getAllowance(tokenB, owner, router);

  const needsApprovalA = BigInt(allowanceA) < BigInt(amountA);
  const needsApprovalB = BigInt(allowanceB) < BigInt(amountB);

  return { needsApprovalA, needsApprovalB };
};

// UI shows approval buttons if needed
if (needsApprovalA) {
  <Button onClick={() => approve(tokenA, router, maxUint128)}>
    Approve {tokenA.symbol}
  </Button>
}
```

**Ventajas**:
- UI clara
- User control
- Gas efficient (no unnecessary approvals)

**Desventajas**:
- Race condition si amount cambia
- Stale cache puede mostrar incorrect state

### Pattern 2: Infinite Approval (Gas Saving)

```typescript
// Approve max amount once
const MAX_UINT128 = '170141183460469231731687303715884105727';

await approve(tokenAddress, spenderAddress, MAX_UINT128, futureExpiration);
```

**Ventajas**:
- Solo una vez por token
- UX mejor (no approvals repetidos)
- Menos gas a largo plazo

**Desventajas**:
- Security risk (spender tiene control permanente)
- Users pueden no estar comfortable

### Pattern 3: Exact Approval (Security Focused)

```typescript
// Approve exact amount needed
await approve(tokenAddress, spenderAddress, amountNeeded, nearExpiration);
```

**Ventajas**:
- Maximum security
- Limited exposure
- Auto-expires

**Desventajas**:
- Approval necesario en cada transacción
- Más gas
- Peor UX

### Pattern 4: Batch Approval (Optimización)

```typescript
// Approve multiple tokens in single transaction
const operations = [
  createApproveOperation(tokenA, router, amountA),
  createApproveOperation(tokenB, router, amountB),
];

await submitBatchTransaction(operations);
```

**Ventajas**:
- Atomic (all or nothing)
- Menos confirmaciones
- Mejor UX

**Desventajas**:
- Más complejo de implementar
- Un failure = all fail
- Debugging más difícil

---

## 🚨 Common Pitfalls Identificados

### 1. Stale Allowance Cache

```typescript
// ❌ MALO: Cache puede estar stale
const allowance = await getCachedAllowance(token, owner, spender);
if (BigInt(allowance) >= BigInt(amount)) {
  // Proceder con transaction → PUEDE FALLAR
}

// ✅ BUENO: Re-check antes de transaction crítica
const freshAllowance = await getAllowance(token, owner, spender);
if (BigInt(freshAllowance) >= BigInt(amount)) {
  // Proceder con transaction
}
```

### 2. Amount Change Mid-Flow

```typescript
// ❌ MALO: Approval checked para amount X, pero user cambió a Y
checkApprovals(amountX); // Returns OK
// User changes amount to amountY (Y > X)
submitTransaction(amountY); // FAILS - insufficient allowance

// ✅ BUENO: Re-check antes de submit
const latestAmounts = getCurrentAmounts();
checkApprovals(latestAmounts); // Re-check con amounts actuales
if (allApproved) {
  submitTransaction(latestAmounts);
}
```

### 3. Missing Wallet Signature

```typescript
// ❌ MALO: Placeholder sin firma real
const from = account.address; // TODO: This should be a signature

// ✅ BUENO: Obtener firma de wallet
const signedXDR = await walletKit.signTransaction(transaction.toXDR());
const signedTx = TransactionBuilder.fromXDR(signedXDR, networkPassphrase);
```

### 4. No Error Recovery

```typescript
// ❌ MALO: Approval falla y user queda stuck
try {
  await approve(token, spender, amount);
} catch (error) {
  // No retry, no UI feedback
}

// ✅ BUENO: Retry logic y UI feedback
try {
  await withRetry(() => approve(token, spender, amount), { maxAttempts: 3 });
} catch (error) {
  showToast({ type: 'error', title: 'Approval failed', action: 'Retry' });
}
```

---

## 🎯 Recommendations para astro-swap

### Basado en Research

1. **Adopt Two-Step Approval** (Stellar Official Recommendation)
   - Set to 0 first
   - Verify no spend occurred
   - Set new amount

2. **Use Infinite Approval como Default**
   - Mejor UX (como Uniswap, Soroswap)
   - Dar opción de "Exact Amount" para users security-conscious

3. **Implement Approval Guard Hook**
   - useApprovalGuard que enforce re-check antes de transaction
   - Previene race conditions
   - Integrado con retry/cache/metrics existente

4. **Add Expiration Management**
   - Set expiration_ledger inteligentemente
   - Far future para infinite approvals
   - Near future para exact approvals

5. **Explicit UI States**
   - CHECKING_ALLOWANCES
   - NEEDS_APPROVAL
   - APPROVING
   - APPROVED
   - ERROR (con retry)

### Integration con Enterprise Architecture

```typescript
// lib/stellar/approval-manager.ts
import { withRetry } from './retry';
import { rpcCircuitBreaker } from './circuit-breaker';
import { metrics, measureTiming } from './metrics';
import { contractCallCache } from './cache';

export class ApprovalManager {
  async checkAllowance(token, owner, spender): Promise<bigint> {
    // Use cache
    const cached = contractCallCache.get(token, 'allowance', [owner, spender]);
    if (cached) return BigInt(cached);

    // Call with retry + circuit breaker + metrics
    const allowance = await measureTiming(
      'approval.checkAllowance',
      () => withRetry(
        () => rpcCircuitBreaker.execute(() =>
          callContract(token, 'allowance', [owner, spender], owner)
        )
      ),
      { token }
    );

    // Cache for 10 seconds (shorter than general cache)
    contractCallCache.set(token, 'allowance', [owner, spender], allowance.toString(), 10000);

    return BigInt(allowance);
  }

  async executeTwoStepApproval(token, spender, newAmount): Promise<void> {
    metrics.increment('approval.twoStep.started');

    // Step 1: Set to 0
    await this.approve(token, spender, 0);

    // Step 2: Verify (with retry for propagation)
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for blockchain
    const currentAllowance = await this.checkAllowance(token, owner, spender);

    if (currentAllowance !== 0n) {
      throw new Error('Spender spent during reset - retry approval');
    }

    // Step 3: Set new amount
    await this.approve(token, spender, newAmount);

    metrics.increment('approval.twoStep.success');
  }
}
```

---

## 📊 Comparison Matrix

| Feature | Current (astro-swap) | Soroswap | Phoenix | Recommended |
|---------|---------------------|----------|---------|-------------|
| Approval Strategy | Infinite | ? | ? | Infinite (with option) |
| Race Condition Prevention | ❌ | ? | ? | ✅ Two-step |
| Cache Invalidation | Manual | ? | ? | ✅ Automatic |
| Retry Logic | ❌ | ? | ? | ✅ Integrated |
| Metrics | ❌ | ? | ? | ✅ Full tracking |
| State Machine | ❌ | ? | ? | ✅ Explicit states |
| Expiration Management | ❌ | ✅ | ✅ | ✅ Smart defaults |

---

## 🔗 Referencias

### Proyectos Production
- **Soroswap**: [Frontend](https://github.com/soroswap/frontend) | [Core](https://github.com/soroswap/core) | [Docs](https://github.com/soroswap/docs)
- **Phoenix Protocol**: [Organization](https://github.com/Phoenix-Protocol-Group) | [Contracts](https://github.com/Phoenix-Protocol-Group/phoenix-contracts)
- **Stellar Example DApp**: [Repo](https://github.com/stellar/soroban-example-dapp) | [Issue #13](https://github.com/stellar/soroban-example-dapp/issues/13)

### Official Documentation
- **Token Interface**: https://developers.stellar.org/docs/tokens/token-interface
- **Stellar Asset Contract**: https://developers.stellar.org/docs/tokens/stellar-asset-contract
- **Authorization**: https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization
- **Freighter Integration**: https://developers.stellar.org/docs/build/guides/freighter

### Frameworks
- **@soroban-react**: [Docs](https://soroban-react.gitbook.io/index) | [GitHub](https://github.com/paltalabs/soroban-react)
- **Soroban React Payment**: https://github.com/stellar/soroban-react-payment
- **Soroban React Mint Token**: https://github.com/stellar/soroban-react-mint-token

### Tutorials
- **Freighter + React Integration**: https://medium.com/@shubhampalriwala/integrating-freigther-wallet-with-react-on-soroban-73f5eb249799
- **Soroban Token Tutorial**: https://jamesbachini.com/soroban-tokens/

### Security
- **EIP-20 Race Condition**: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

---

## ✅ Next Steps

1. **Implementar ApprovalManager class** con two-step approval
2. **Crear useApprovalGuard hook** que use ApprovalManager
3. **Integrar con Pool.tsx** UI con explicit states
4. **Add expiration management** con smart defaults
5. **Test en testnet** con wallet real
6. **Monitor metrics** para approval success rate

---

**Research completed**: 2026-03-17
**Status**: Ready para implementation
