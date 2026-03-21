# Auditoría Completa del Frontend - Problemas y Soluciones

**Fecha**: 2026-03-17
**Tipo**: Centralización de código y corrección de problemas
**Objetivo**: Código 100% mantenible, sin duplicación, con actualización automática de UI

---

## 🎯 Resumen Ejecutivo

### Problemas Encontrados
1. ✅ **React.memo() bloqueando actualizaciones** → YA ARREGLADO
2. ❌ **Código duplicado** → Dummy account repetido 3 veces
3. ❌ **Constantes hardcodeadas** → Token addresses, explorer URLs dispersos
4. ⚠️  **Componentes adicionales con React.memo()** → Necesitan revisión
5. ❌ **Acceso frágil a arrays** → `BASE_TOKENS[0]`, `BASE_TOKENS[1]`
6. ❌ **URLs hardcodeadas** → Explorer URL, API endpoints

---

## 1. ✅ Problema RESUELTO: React.memo() + refetchQueries

### Problema
`PoolCard` envuelto con `React.memo()` no se actualizaba porque `refetchQueries` reutilizaba referencias de objetos.

### Solución Implementada
Cambiar de `refetchQueries` → `invalidateQueries` en:
- `/src/hooks/usePool.ts` (add y remove liquidity)
- `/src/hooks/useSwap.ts` (swap)

**Status**: ✅ FIXED

---

## 2. ❌ PROBLEMA: Código Duplicado - DUMMY_ACCOUNT

### Ubicaciones
```typescript
// 1. /src/lib/token-indexer.ts (línea 57)
const dummyAccount = new StellarSdk.Account(
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  '0'
);

// 2. /src/lib/token-indexer.ts (línea 179) - DUPLICADO
const dummyAccount = new StellarSdk.Account(
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  '0'
);

// 3. /src/components/common/AddTokenModal.tsx (línea 37) - DUPLICADO
const dummyAccount = new StellarSdk.Account(
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  '0'
);
```

### Solución
Crear archivo de constantes centralizado:

**`/src/lib/constants/stellar.ts`:**
```typescript
import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Dummy account for Soroban contract simulations
 * This is a valid Stellar address format used only for contract calls that don't modify state
 */
export const DUMMY_SIMULATION_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/**
 * Helper function to create a dummy account for simulations
 * Eliminates code duplication across the codebase
 */
export function createDummyAccount(): StellarSdk.Account {
  return new StellarSdk.Account(DUMMY_SIMULATION_ADDRESS, '0');
}
```

**Actualizar archivos:**
```typescript
// token-indexer.ts
import { createDummyAccount } from './constants/stellar';
const dummyAccount = createDummyAccount(); // ✅ Usar helper

// AddTokenModal.tsx
import { createDummyAccount } from '../../lib/constants/stellar';
const dummyAccount = createDummyAccount(); // ✅ Usar helper
```

**Impacto**: 3 archivos actualizados, código DRY

---

## 3. ❌ PROBLEMA: Token Addresses Hardcodeados

### Ubicaciones

**`/src/stores/tokenStore.ts` (líneas 12, 16):**
```typescript
const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const USDC_TESTNET_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
```

**`/src/lib/tokens/whitelist.json` (línea 8):**
```json
"contractId": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
```

**`/src/components/Swap/SwapCard.tsx` (líneas 12, 17-18):**
```typescript
import { BASE_TOKENS } from '../../stores/tokenStore';
const DEFAULT_TOKEN_IN = BASE_TOKENS[0]; // ❌ Frágil
const DEFAULT_TOKEN_OUT = BASE_TOKENS[1]; // ❌ Frágil
```

### Problema
- Token addresses repetidos en múltiples lugares
- Acceso por índice (`[0]`, `[1]`) es frágil
- Si el orden de `BASE_TOKENS` cambia, SwapCard se rompe
- No está centralizado

### Solución

**`/src/lib/constants/tokens.ts`:**
```typescript
/**
 * Centralized Token Addresses (Testnet)
 * Single source of truth for all token contract IDs
 */

// Native XLM (SAC - Stellar Asset Contract)
export const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Circle USDC on Stellar Testnet
// Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
export const USDC_TESTNET_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

/**
 * Default token pair for SwapCard and other components
 * Using named constants instead of array indices for robustness
 */
export const DEFAULT_SWAP_PAIR = {
  tokenIn: NATIVE_XLM_SAC,
  tokenOut: USDC_TESTNET_SAC,
} as const;

/**
 * Favorite tokens (for initial UI state)
 */
export const DEFAULT_FAVORITES = [NATIVE_XLM_SAC, USDC_TESTNET_SAC] as const;
```

**Actualizar archivos:**

```typescript
// tokenStore.ts
import { NATIVE_XLM_SAC, USDC_TESTNET_SAC, DEFAULT_FAVORITES } from '../lib/constants/tokens';

// SwapCard.tsx
import { useTokenStore } from '../../stores/tokenStore';
import { DEFAULT_SWAP_PAIR } from '../../lib/constants/tokens';

// Inside component:
const defaultTokenIn = useTokenStore(state =>
  state.tokens.find(t => t.address === DEFAULT_SWAP_PAIR.tokenIn)
);
const defaultTokenOut = useTokenStore(state =>
  state.tokens.find(t => t.address === DEFAULT_SWAP_PAIR.tokenOut)
);

const [tokenIn, setTokenIn] = useState<Token | null>(defaultTokenIn || null);
const [tokenOut, setTokenOut] = useState<Token | null>(defaultTokenOut || null);
```

**Impacto**:
- 3 archivos actualizados
- SwapCard ya no depende de índices de array
- Single source of truth para token addresses

---

## 4. ❌ PROBLEMA: URLs Hardcodeadas

### Ubicaciones

**`/src/components/common/TransactionTracker.tsx` (línea 6):**
```typescript
const STELLAR_EXPLORER_URL = 'https://testnet.stellarchain.io/transactions';
```

### Problema
- URL hardcodeada en componente
- Cambiar entre testnet/mainnet requiere modificar código
- No está en variables de entorno

### Solución

**`/src/lib/constants/network.ts`:**
```typescript
/**
 * Network configuration
 * Environment-specific URLs for Stellar services
 */

const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';

export const STELLAR_EXPLORER_URL = NETWORK === 'mainnet'
  ? 'https://stellarchain.io/transactions'
  : 'https://testnet.stellarchain.io/transactions';

export const STELLAR_HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';

/**
 * Helper to get explorer link for a transaction
 */
export function getExplorerLink(txHash: string): string {
  return `${STELLAR_EXPLORER_URL}/${txHash}`;
}
```

**`.env` (agregar):**
```bash
VITE_STELLAR_NETWORK=testnet  # o 'mainnet' para producción
```

**Actualizar `TransactionTracker.tsx`:**
```typescript
import { getExplorerLink } from '../../lib/constants/network';

// Usar en lugar de hardcoded URL
<a href={getExplorerLink(tx.hash)} target="_blank" rel="noopener noreferrer">
  View on Explorer
</a>
```

**Impacto**:
- 1 archivo actualizado
- Fácil switch entre testnet/mainnet
- DRY (evita repetir lógica de URLs)

---

## 5. ⚠️  PROBLEMA POTENCIAL: Otros Componentes con React.memo()

### Componentes Encontrados

#### A. `StakingCard` ✅ OK
```typescript
export const StakingCard = memo(function StakingCard({ pool }: StakingCardProps) {
  // ...
  const { stakeInfo, stake, unstake, claimRewards } = useStaking(pool.address);
```

**Análisis**:
- ✅ Recibe `pool` prop que puede mutar
- ✅ Pero usa `useStaking(pool.address)` que es un string primitivo
- ✅ No depende directamente de propiedades mutables del objeto `pool`
- ⚠️  **POTENCIAL PROBLEMA** si `pool` tiene propiedades que cambian (APR, totalStaked, etc)

**Recomendación**: Monitorear si Staking tiene problemas de actualización similares

#### B. `TransactionTracker` ✅ OK
```typescript
export const TransactionTracker = memo(function TransactionTracker() {
  const transactions = useTransactionStore((state) => state.transactions);
```

**Análisis**:
- ✅ No recibe props, usa Zustand directamente
- ✅ Zustand fuerza re-renders automáticamente
- ✅ No hay problema de shallow comparison

#### C. `SwapCard` ✅ OK
```typescript
export const SwapCard = memo(function SwapCard() {
  const [tokenIn, setTokenIn] = useState<Token | null>(DEFAULT_TOKEN_IN);
```

**Análisis**:
- ✅ No recibe props, todo es estado interno
- ✅ No hay problema

#### D. `AddTokenModal` ✅ OK
```typescript
export const AddTokenModal = memo(function AddTokenModal({ isOpen, onClose }: AddTokenModalProps) {
```

**Análisis**:
- ✅ Solo recibe primitivos (boolean, function)
- ✅ No hay problema

#### E. Otros componentes pequeños (TokenInput, ConnectWallet, etc)
**Análisis**: Todos OK, solo reciben primitivos o callbacks

### Componentes que NECESITAN REVISIÓN

#### `StakingCard` - Monitorear
Si el usuario reporta que los datos de staking no se actualizan (APR, totalStaked, userStake), aplicar la misma solución que PoolCard:

**Opción 1:** Remover memo
```typescript
export function StakingCard({ pool }: StakingCardProps) {
```

**Opción 2:** Comparación personalizada
```typescript
export const StakingCard = memo(
  function StakingCard({ pool }: StakingCardProps) { ... },
  (prev, next) => {
    return (
      prev.pool.address === next.pool.address &&
      prev.pool.apr === next.pool.apr &&
      prev.pool.totalStaked === next.pool.totalStaked
      // Comparar campos específicos que cambian
    );
  }
);
```

---

## 6. ✅ SOLUCIÓN: Archivo de Constantes Centralizado

### Nueva Estructura

```
src/
└── lib/
    └── constants/
        ├── index.ts          # Re-export todo
        ├── stellar.ts        # DUMMY_ACCOUNT, helpers
        ├── tokens.ts         # Token addresses, favorites
        ├── network.ts        # Explorer URLs, Horizon URLs
        └── contracts.ts      # Ya existe en lib/contracts.ts (mover aquí?)
```

### `src/lib/constants/index.ts` (barrel export)
```typescript
/**
 * Centralized constants for the entire frontend
 * Single source of truth for all hardcoded values
 */

export * from './stellar';
export * from './tokens';
export * from './network';
```

**Uso en cualquier archivo:**
```typescript
import {
  createDummyAccount,
  NATIVE_XLM_SAC,
  DEFAULT_SWAP_PAIR,
  getExplorerLink
} from '@/lib/constants';
```

---

## 7. Plan de Implementación

### Fase 1: Crear Archivos de Constantes (15 min)
1. ✅ Crear `/src/lib/constants/stellar.ts`
2. ✅ Crear `/src/lib/constants/tokens.ts`
3. ✅ Crear `/src/lib/constants/network.ts`
4. ✅ Crear `/src/lib/constants/index.ts`

### Fase 2: Migrar DUMMY_ACCOUNT (10 min)
1. ✅ Actualizar `/src/lib/token-indexer.ts` (2 lugares)
2. ✅ Actualizar `/src/components/common/AddTokenModal.tsx`
3. ✅ Verificar compilación

### Fase 3: Migrar Token Addresses (15 min)
1. ✅ Actualizar `/src/stores/tokenStore.ts`
2. ✅ Actualizar `/src/components/Swap/SwapCard.tsx`
3. ✅ Actualizar `/src/lib/tokens/whitelist.json`
4. ✅ Verificar compilación

### Fase 4: Migrar URLs (10 min)
1. ✅ Crear `/src/lib/constants/network.ts`
2. ✅ Actualizar `/src/components/common/TransactionTracker.tsx`
3. ✅ Agregar `VITE_STELLAR_NETWORK` a `.env`
4. ✅ Verificar compilación

### Fase 5: Testing Completo (20 min)
1. ✅ Test manual: Add liquidity → UI actualiza automáticamente
2. ✅ Test manual: Remove liquidity → UI actualiza automáticamente
3. ✅ Test manual: Swap → UI actualiza automáticamente
4. ✅ Test manual: Add custom token → funciona correctamente
5. ✅ Test manual: Transaction tracker → links funcionan

**Tiempo Total**: ~70 minutos (1 hora 10 min)

---

## 8. Beneficios Esperados

### Antes (Estado Actual)
❌ Código duplicado en 3 lugares (DUMMY_ACCOUNT)
❌ Token addresses hardcodeados en 3 lugares
❌ URLs hardcodeadas en componentes
❌ Acceso frágil a arrays (`BASE_TOKENS[0]`)
❌ Difícil cambiar entre testnet/mainnet
❌ No hay single source of truth

### Después (Post-Centralización)
✅ Zero duplicación de código
✅ Single source of truth para todas las constantes
✅ Fácil cambiar entre testnet/mainnet (1 variable de entorno)
✅ Código mantenible y escalable
✅ Fácil agregar nuevos tokens/networks
✅ TypeScript ayuda con autocompletado
✅ Tests más fáciles (mock constantes en un solo lugar)

---

## 9. Checklist de Verificación

### Código
- [ ] `/src/lib/constants/stellar.ts` creado
- [ ] `/src/lib/constants/tokens.ts` creado
- [ ] `/src/lib/constants/network.ts` creado
- [ ] `/src/lib/constants/index.ts` creado
- [ ] `/src/lib/token-indexer.ts` actualizado (2 lugares)
- [ ] `/src/components/common/AddTokenModal.tsx` actualizado
- [ ] `/src/stores/tokenStore.ts` actualizado
- [ ] `/src/components/Swap/SwapCard.tsx` actualizado
- [ ] `/src/components/common/TransactionTracker.tsx` actualizado
- [ ] `.env` actualizado con `VITE_STELLAR_NETWORK`

### Testing
- [ ] `pnpm build` pasa sin errores
- [ ] `pnpm test` pasa (si hay tests)
- [ ] Add liquidity actualiza UI automáticamente (3 segundos)
- [ ] Remove liquidity actualiza UI automáticamente
- [ ] Swap actualiza UI automáticamente
- [ ] Add custom token funciona
- [ ] Transaction explorer links funcionan

### Documentación
- [ ] Este documento está completo
- [ ] REACT_MEMO_BUG_FIX.md existe y está actualizado
- [ ] README actualizado si es necesario

---

## 10. Próximos Pasos (Futuro)

### Optimizaciones Adicionales (No urgente)
1. **IndexedDB caching** para pool data (offline-first)
2. **Horizon Streaming API** para updates en tiempo real sin polling
3. **WebSocket connection** para eventos de contratos
4. **Service Worker** para notificaciones de transacciones

### Refactoring Futuro (Nice to have)
1. Mover `/src/lib/contracts.ts` → `/src/lib/constants/contracts.ts`
2. Crear `/src/lib/constants/ui.ts` para colores, tamaños, etc
3. Crear `/src/lib/constants/abis.ts` si necesitamos ABIs específicos

---

## 11. Resumen Final

### ✅ Arreglado
- React.memo() bug en PoolCard (invalidateQueries en lugar de refetchQueries)

### 📋 Por Hacer
- Centralizar DUMMY_ACCOUNT (3 archivos)
- Centralizar token addresses (3 archivos)
- Centralizar URLs (1 archivo)
- Arreglar acceso frágil a `BASE_TOKENS[0]`

### ⚠️  Monitorear
- StakingCard por si tiene el mismo problema que PoolCard

### 🎯 Objetivo
**Frontend 100% profesional, mantenible, escalable, con UI auto-actualizable**

---

**Status**: 📝 PLAN COMPLETO - LISTO PARA IMPLEMENTAR
**Prioridad**: 🔥 ALTA - Afecta mantenibilidad y experiencia de usuario
**Tiempo Estimado**: 70 minutos de trabajo enfocado
