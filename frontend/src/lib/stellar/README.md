# Stellar SDK - Modular Architecture

Arquitectura modular y escalable para interacciones con Stellar/Soroban.

## Estructura

```
lib/stellar/
├── config.ts           # Configuración de red (single source of truth)
├── errors.ts           # Manejo centralizado de errores
├── confirmation.ts     # Estrategias de confirmación de transacciones
├── transaction.ts      # Construcción y envío de transacciones
├── accounts.ts         # Operaciones de cuentas y balances
└── index.ts            # Re-exports para imports limpios
```

## Uso

### Configuración (config.ts)

```typescript
import { NETWORK_CONFIG, horizonServer, sorobanServer, isTestnet } from '@/lib/stellar/config';

// Acceso a configuración
console.log(NETWORK_CONFIG.network); // 'testnet' | 'mainnet'
console.log(NETWORK_CONFIG.passphrase);
console.log(NETWORK_CONFIG.confirmationStrategy); // 'horizon' | 'rpc' | 'skip'

// Usar servidores
const account = await horizonServer.loadAccount(address);
const simResult = await sorobanServer.simulateTransaction(tx);
```

### Transacciones (transaction.ts)

```typescript
import { buildAndSubmitTransaction, type WalletSigner } from '@/lib/stellar/transaction';

// Crear signer
const signer: WalletSigner = {
  signTransaction: async (xdr: string) => {
    // Firma con wallet
    return signedXdr;
  }
};

// Construir y enviar transacción
const result = await buildAndSubmitTransaction({
  sourceAddress: 'GXXX...',
  operations: [operation1, operation2],
  signer,
  skipConfirmation: false, // opcional
});

console.log(result.hash);
console.log(result.confirmation.status); // 'SUCCESS' | 'FAILED' | 'PENDING' | 'NOT_FOUND'
```

### Confirmación (confirmation.ts)

```typescript
import { confirmTransaction, confirmViaHorizon, confirmViaRPC } from '@/lib/stellar/confirmation';

// Usar estrategia configurada
const result = await confirmTransaction(txHash);

// O usar estrategia específica
const horizonResult = await confirmViaHorizon(txHash);
const rpcResult = await confirmViaRPC(txHash);
```

### Errores (errors.ts)

```typescript
import { parseError, StellarTransactionError } from '@/lib/stellar/errors';

try {
  await someOperation();
} catch (error) {
  const { message, code } = parseError(error);
  console.error(`Error [${code}]: ${message}`);
}

// Lanzar error custom
throw new StellarTransactionError(
  'Transaction failed',
  'TX_FAILED',
  { details: '...' }
);
```

### Cuentas (accounts.ts)

```typescript
import { getAccountBalance, getTokenBalance } from '@/lib/stellar/accounts';

const xlmBalance = await getAccountBalance('GXXX...');
const usdcBalance = await getTokenBalance('GXXX...', 'CXXX...');
```

## Estrategias de Confirmación

Configurar en `.env`:

```bash
# Usar Horizon (más confiable, recomendado para producción)
VITE_CONFIRMATION_STRATEGY=horizon

# Usar RPC (más rápido pero inestable en testnet)
VITE_CONFIRMATION_STRATEGY=rpc

# Skip (para desarrollo/debugging)
VITE_CONFIRMATION_STRATEGY=skip
```

O modificar directamente en `config.ts`:

```typescript
export const NETWORK_CONFIG = {
  // ...
  confirmationStrategy: 'horizon', // ← cambiar aquí
}
```

## Cambiar Estrategia en Runtime

```typescript
import { NETWORK_CONFIG } from '@/lib/stellar/config';

// Temporalmente skip confirmación
const originalStrategy = NETWORK_CONFIG.confirmationStrategy;
(NETWORK_CONFIG as any).confirmationStrategy = 'skip';

// ... hacer transacciones

// Restaurar
(NETWORK_CONFIG as any).confirmationStrategy = originalStrategy;
```

## Backwards Compatibility

El archivo `lib/stellar.ts` mantiene compatibilidad con código antiguo:

```typescript
// ❌ Código antiguo (aún funciona)
import { buildAndSubmitTransaction } from '@/lib/stellar';

// ✅ Código nuevo (preferido)
import { buildAndSubmitTransaction } from '@/lib/stellar/transaction';
```

## Migración

1. **No cambiar nada** - código antiguo sigue funcionando
2. **Actualizar imports gradualmente** - migrar a imports específicos
3. **Remover stellar.ts** - cuando todo migrado, eliminar wrapper

## Testing

Cada módulo es independiente y testeable:

```typescript
import { confirmViaHorizon } from '@/lib/stellar/confirmation';
import { vi } from 'vitest';

// Mock horizon server
vi.mock('@/lib/stellar/config', () => ({
  horizonServer: {
    transactions: () => ({
      transaction: vi.fn(),
    }),
  },
}));

// Test
const result = await confirmViaHorizon('hash');
expect(result.status).toBe('SUCCESS');
```

## Benefits

✅ **Separación de responsabilidades** - cada módulo tiene un propósito claro
✅ **Testeable** - módulos independientes son fáciles de testear
✅ **Escalable** - agregar nuevas features es simple
✅ **Mantenible** - bugs aislados, fácil debugging
✅ **Configurable** - cambiar estrategias sin modificar código
✅ **Type-safe** - TypeScript en todos los módulos
✅ **Backwards compatible** - no rompe código existente

## Roadmap

- [ ] Agregar retry logic con exponential backoff
- [ ] Implementar caching de contract calls
- [ ] Agregar métricas/monitoring
- [ ] WebSocket streaming para confirmaciones en tiempo real
- [ ] Multi-signature support
- [ ] Transaction batching
