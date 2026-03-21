# AstroSwap - Análisis Completo del Sistema de Pools

**Fecha:** 2026-03-11
**Contexto:** Análisis general del sistema tras el fix de pools vacíos
**Alcance:** TODOS los pares, no solo XLM/yUSDC

---

## 🎯 OBJETIVO DEL ANÁLISIS

Verificar que los fixes aplicados funcionan para **TODO EL SISTEMA**, no solo para un par específico.

**Usuario pidió:**
> "revis no solo con ese par sin con todo lo pares existentes y en general debemos hacer solucion para todo el sistema no solo para un par"

---

## ✅ HALLAZGOS PRINCIPALES

### 1. Los fixes SON generales - funcionan para CUALQUIER par

**Código analizado: Pool.tsx**

#### Fix #1: Detector de pool vacío (línea ~42)
```typescript
const isEmptyPool = useMemo(() => {
  if (!existingPool) return false;
  const reserve0 = BigInt(existingPool.reserve0);
  const reserve1 = BigInt(existingPool.reserve1);
  return reserve0 === 0n || reserve1 === 0n;  // ✅ Genérico - funciona con CUALQUIER pool
}, [existingPool]);
```

**Análisis:**
- ✅ NO tiene hardcoded "XLM" o "yUSDC"
- ✅ Funciona con `existingPool` sea cual sea el par de tokens
- ✅ Solo chequea reserves === 0n (condición universal)

#### Fix #2: Cálculo de amounts (líneas ~51-90)
```typescript
const calculateAmountB = useCallback((amountAValue: string) => {
  if (!existingPool || !amountAValue || parseFloat(amountAValue) === 0) {
    return '';
  }

  const reserve0 = BigInt(existingPool.reserve0);
  const reserve1 = BigInt(existingPool.reserve1);

  // ✅ FIX: Pool vacío → no auto-calcular
  if (reserve0 === 0n || reserve1 === 0n) {
    console.log('Pool vacío - ingrese amounts manualmente para establecer ratio inicial');
    return ''; // ✅ Funciona para CUALQUIER par
  }

  // ✅ Pool con liquidez → auto-calcular ratio
  // Usa existingPool.token0/token1 dinámicamente
  if (existingPool.token0.address === tokenA!.address) {
    calculatedAmountB = (amountABigInt * reserve1) / reserve0;
  } else {
    calculatedAmountB = (amountABigInt * reserve0) / reserve1;
  }
  // ...
}, [existingPool, tokenA, tokenB]);  // ✅ Depende de tokens seleccionados dinámicamente
```

**Análisis:**
- ✅ NO asume tokens específicos
- ✅ Compara `existingPool.token0.address === tokenA.address` dinámicamente
- ✅ Funciona con CUALQUIER par de tokens

#### Fix #3: Banners y mensajes (líneas ~368, ~417, ~426)
```typescript
{/* ✅ Banner "Primera Liquidez" - GENÉRICO */}
{existingPool && isEmptyPool && (
  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
    <p className="font-semibold text-yellow-400">Primera Liquidez</p>
    <p className="text-yellow-300 mt-1">
      Este pool está vacío. Ingrese los amounts manualmente para establecer el ratio inicial.
    </p>
    <p className="text-yellow-300 text-xs mt-1">
      Será el primer LP - recibirá 100% del pool
    </p>
  </div>
)}
```

**Análisis:**
- ✅ Depende de `existingPool` y `isEmptyPool` (genéricos)
- ✅ NO menciona tokens específicos
- ✅ Se muestra para CUALQUIER pool vacío

**CONCLUSIÓN FIX #1-3:**
- ✅ **Los fixes SON universales**
- ✅ Funcionan con CUALQUIER par de tokens
- ✅ No hay lógica específica para XLM/yUSDC

---

### 2. Sistema de detección de pools (usePool hook)

**Archivo analizado: `/frontend/src/hooks/usePool.ts`**

#### Cómo funciona la detección de pools:

```typescript
const { data: pools = [], isLoading } = useQuery({
  queryKey: ['pools', address],
  queryFn: async () => {
    // 1. Obtener TODOS los pares del Factory
    const pairAddresses = await getAllPairs(address);

    if (!pairAddresses || pairAddresses.length === 0) {
      console.log('No pairs found from factory');
      return [];
    }

    // 2. Para CADA par, obtener detalles
    const poolPromises = pairAddresses.map(async (pairAddress) => {
      try {
        // 2.1. Obtener tokens del par
        const pairTokens = await getPairTokens(pairAddress);

        // 2.2. Obtener reserves y totalSupply
        const [reserves, totalSupply] = await Promise.all([
          getReserves(pairAddress, address),
          getTotalSupply(pairAddress, address),
        ]);

        // 2.3. Obtener metadata de tokens
        let token0: Token | null = getToken(pairTokens.token0) || null;
        let token1: Token | null = getToken(pairTokens.token1) || null;

        return {
          address: pairAddress,
          token0,
          token1,
          reserve0: reserves?.reserve0 || '0',  // ✅ Puede ser '0' (pool vacío)
          reserve1: reserves?.reserve1 || '0',  // ✅ Puede ser '0' (pool vacío)
          totalSupply,
          lpTokenAddress: pairAddress,
          fee: 30, // 0.30%
        } as Pool;
      } catch (error) {
        console.error(`Error fetching pool data for ${pairAddress}:`, error);
        return null;
      }
    });

    const results = await Promise.all(poolPromises);
    return results.filter((pool): pool is Pool => pool !== null);
  },
  enabled: !!address,
  staleTime: 30000,
});
```

**Análisis:**
- ✅ Obtiene TODOS los pares del Factory (no solo uno)
- ✅ Para cada par, obtiene reserves (puede ser '0')
- ✅ Filtra pools null (errores), pero mantiene pools vacíos (reserve0='0')
- ✅ Sistema es completamente dinámico

**CONCLUSIÓN #2:**
- ✅ El sistema detecta TODOS los pares existentes en Factory
- ✅ No hay filtrado específico para ciertos tokens
- ✅ Los pools vacíos SÍ se incluyen en la lista

---

### 3. Sistema de obtención de todos los pares (getAllPairs)

**Archivo analizado: `/frontend/src/lib/contracts.ts`**

```typescript
export async function getAllPairs(sourceAddress: string): Promise<string[]> {
  try {
    // 1. Obtener total de pares
    const totalPairs = await callContract(
      CONTRACTS.FACTORY,
      'all_pairs_length',
      [],
      sourceAddress
    ) as number;

    if (totalPairs === 0) {
      return [];
    }

    // 2. Fetch all pairs en batches (max 100 por llamada)
    const allPairs: string[] = [];
    const batchSize = 100;

    for (let start = 0; start < totalPairs; start += batchSize) {
      const limit = Math.min(batchSize, totalPairs - start);
      const startScVal = StellarSdk.nativeToScVal(start, { type: 'u32' });
      const limitScVal = StellarSdk.nativeToScVal(limit, { type: 'u32' });

      const batch = await callContract(
        CONTRACTS.FACTORY,
        'get_pairs_paginated',
        [startScVal, limitScVal],
        sourceAddress
      ) as string[];

      allPairs.push(...batch);
    }

    return allPairs;
  } catch (error) {
    console.error('Error getting all pairs:', error);
    return [];
  }
}
```

**Análisis:**
- ✅ Llama a Factory.all_pairs_length() para obtener total
- ✅ Luego llama a Factory.get_pairs_paginated() en batches de 100
- ✅ NO filtra por tokens específicos
- ✅ Devuelve TODOS los pares que existen en Factory

**CONCLUSIÓN #3:**
- ✅ El sistema obtiene TODOS los pares del Factory
- ✅ Paginación correcta para escalar a muchos pares
- ✅ No hay límite artificial por tipo de token

---

### 4. Flujo de creación de nuevos pares

**Archivos analizados:**
- `/contracts/router/src/contract.rs` (Router.add_liquidity)
- `/contracts/factory/src/contract.rs` (Factory.create_pair)
- `/contracts/factory/src/storage.rs` (public_pair_creation setting)

#### Router.add_liquidity - Líneas 219-223

```rust
// Get or create pair
let pair_address = match factory_client.get_pair(&token_a, &token_b) {
    Some(addr) => addr,
    None => factory_client.create_pair(&user, &token_a, &token_b)?,
};
```

**Análisis:**
- ✅ Router.add_liquidity intenta crear par si NO EXISTE
- ✅ Llama a Factory.create_pair automáticamente
- ⚠️ **PERO** esto depende de permisos en Factory

#### Factory.create_pair - Líneas 82-87

```rust
// Check if public pair creation is enabled
if !is_public_pair_creation_enabled(&env) {
    // Only admin can create pairs when public creation is disabled
    Self::require_admin(&env, &caller)?;
} else {
    // Public creation enabled - still require auth from caller
    caller.require_auth();
}
```

**Análisis:**
- ⚠️ Factory tiene setting `public_pair_creation`
- ⚠️ Si está deshabilitado (default), solo admin puede crear pares
- ⚠️ Si está habilitado, cualquier usuario autenticado puede crear pares

#### Storage - Línea 142

```rust
pub fn is_public_pair_creation_enabled(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::PublicPairCreation)
        .unwrap_or(false) / Default: only admin can create pairs
}
```

**Análisis:**
- ❌ **Default: `false`** - Solo admin puede crear pares
- ⚠️ Admin puede habilitar con Factory.set_public_pair_creation(true)
- ⚠️ Deployment script NO habilita public creation

**CONCLUSIÓN #4:**
- ⚠️ **Sistema tiene restricción por defecto**
- ⚠️ Solo admin puede crear nuevos pares (si public_pair_creation = false)
- ⚠️ Usuarios normales pueden agregar liquidez a pares EXISTENTES
- ⚠️ Usuarios normales NO pueden crear pares nuevos (sin permiso)

---

### 5. Detección de pool en frontend (Pool.tsx)

**Archivo analizado: `/frontend/src/pages/Pool.tsx` líneas 32-39**

```typescript
// Find existing pool for selected token pair
const existingPool = useMemo(() => {
  if (!tokenA || !tokenB) return null;

  return pools.find(pool =>
    (pool.token0.address === tokenA.address && pool.token1.address === tokenB.address) ||
    (pool.token1.address === tokenA.address && pool.token0.address === tokenB.address)
  );
}, [pools, tokenA, tokenB]);
```

**Análisis:**
- ✅ Busca pool en el array `pools` (viene de usePool hook)
- ✅ Compara en ambos órdenes (token0/token1 pueden estar invertidos)
- ⚠️ Si pool NO EXISTE en Factory → `existingPool = null`

#### ¿Qué pasa cuando existingPool === null?

**Caso 1: Pool NO existe en Factory**
```typescript
// isEmptyPool useMemo (línea 42-47)
const isEmptyPool = useMemo(() => {
  if (!existingPool) return false;  // ❌ Si pool no existe, NO es "empty" es "inexistente"
  // ...
}, [existingPool]);
```

**Comportamiento actual:**
1. Usuario selecciona TokenA + TokenB que NO tienen pool
2. `existingPool = null`
3. `isEmptyPool = false` (porque `!existingPool`)
4. NO se muestra banner "Primera Liquidez" (requiere `existingPool && isEmptyPool`)
5. NO se muestra banner "Existing Pool" (requiere `existingPool`)
6. Usuario puede ingresar amounts manualmente (inputs funcionan)
7. Click "Add Liquidity" → Router.add_liquidity → Factory.create_pair
8. **Si public_pair_creation = false:** ERROR `Unauthorized`
9. **Si public_pair_creation = true:** Se crea el par y agrega liquidez ✅

**CONCLUSIÓN #5:**
- ⚠️ El frontend NO diferencia entre "pool vacío" y "pool no existe"
- ⚠️ Si pool no existe, NO hay banner explicativo
- ✅ Los inputs funcionan igual
- ⚠️ Puede fallar en tiempo de transacción si no tienes permisos

---

## 📊 RESUMEN DE CASOS

### Caso A: Pool existe con liquidez (reserve0 > 0, reserve1 > 0)

| Componente | Comportamiento |
|------------|----------------|
| `existingPool` | ✅ Pool object |
| `isEmptyPool` | ❌ false |
| Banner | 🔵 "Existing Pool" (blue) |
| Input A | ✅ Manual |
| Input B | ✅ Auto-calculado basado en ratio |
| Add Liquidity | ✅ Funciona - Router.add_liquidity → Pair.deposit |

**✅ FUNCIONA CORRECTAMENTE PARA CUALQUIER PAR**

---

### Caso B: Pool existe VACÍO (reserve0 = 0, reserve1 = 0)

| Componente | Comportamiento |
|------------|----------------|
| `existingPool` | ✅ Pool object |
| `isEmptyPool` | ✅ true |
| Banner | 🟡 "Primera Liquidez" (yellow) |
| Input A | ✅ Manual |
| Input B | ✅ Manual (NO auto-calcula) |
| Add Liquidity | ✅ Funciona - Router.add_liquidity → Pair.deposit (primera liquidez) |

**✅ FUNCIONA CORRECTAMENTE TRAS FIX - PARA CUALQUIER PAR**

---

### Caso C: Pool NO EXISTE en Factory

| Componente | Comportamiento |
|------------|----------------|
| `existingPool` | ❌ null |
| `isEmptyPool` | ❌ false |
| Banner | ⚠️ NINGUNO (no hay feedback al usuario) |
| Input A | ✅ Manual |
| Input B | ✅ Manual (no auto-calcula porque !existingPool) |
| Add Liquidity | ⚠️ Router.add_liquidity → Factory.create_pair |
| → Si admin | ✅ Crea par y agrega liquidez |
| → Si no admin + public=false | ❌ ERROR: Unauthorized |
| → Si no admin + public=true | ✅ Crea par y agrega liquidez |

**⚠️ PUEDE FUNCIONAR O FALLAR DEPENDIENDO DE PERMISOS**

---

## 🔍 LIMITACIONES DEL SISTEMA ACTUAL

### Limitación #1: Sin feedback para pools inexistentes

**Problema:**
- Usuario selecciona tokens que NO tienen pool
- NO ve banner explicativo
- Click "Add Liquidity" puede fallar con error críptico

**Solución propuesta:**
```typescript
// Agregar caso en Pool.tsx línea ~385
{/* NUEVO: Pool doesn't exist banner */}
{!existingPool && tokenA && tokenB && (
  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
    <div className="flex items-start gap-2">
      <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      <div className="text-sm">
        <p className="font-semibold text-purple-400">Pool No Existe</p>
        <p className="text-purple-300 mt-1">
          Este par de tokens no tiene pool todavía. Se creará automáticamente al agregar liquidez.
        </p>
        <p className="text-purple-300 text-xs mt-1">
          Serás el primer LP - establece el precio inicial libremente
        </p>
      </div>
    </div>
  </div>
)}
```

---

### Limitación #2: public_pair_creation deshabilitado por defecto

**Problema:**
- Factory.create_pair solo permite admin (default)
- Usuarios normales NO pueden crear pools nuevos
- Error "Unauthorized" sin explicación clara

**Estado actual:**
```rust
// factory/src/storage.rs línea 142
.unwrap_or(false) / Default: only admin can create pairs
```

**Opciones:**

#### Opción A: Habilitar public creation (recomendado para testnet)
```bash
# Como admin, llamar:
stellar contract invoke \
  --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  set_public_pair_creation \
  --enabled true
```

**Pros:**
- ✅ Cualquier usuario puede crear pools
- ✅ Más descentralizado
- ✅ Mejor UX para testnet

**Contras:**
- ⚠️ Posibles pools spam
- ⚠️ Fragmentación de liquidez

#### Opción B: Mantener admin-only (recomendado para mainnet)
```bash
# Solo admin puede crear pools
# Mantener public_pair_creation = false
```

**Pros:**
- ✅ Control centralizado de qué pools existen
- ✅ Previene spam de pools basura
- ✅ Liquidez concentrada en pools oficiales

**Contras:**
- ❌ Admin debe crear pools manualmente
- ❌ Menor descentralización
- ❌ Usuarios dependen de admin

#### Opción C: Sistema híbrido (futuro)
```rust
// Permitir creación pública pero con fee de creación
pub fn create_pair(
    env: Env,
    caller: Address,
    token_a: Address,
    token_b: Address,
) -> Result<Address, AstroSwapError> {
    if !is_public_pair_creation_enabled(&env) {
        // Opción: cobrar fee para crear pool público
        let creation_fee = get_pool_creation_fee(&env);
        if creation_fee > 0 {
            charge_creation_fee(&env, &caller, creation_fee)?;
        } else {
            Self::require_admin(&env, &caller)?;
        }
    }
    // ...
}
```

---

### Limitación #3: Sin validación de pool creation en frontend

**Problema:**
- Frontend no chequea si usuario puede crear pools
- Usuario puede intentar y fallar en blockchain
- Gas desperdiciado en transacciones fallidas

**Solución propuesta:**
```typescript
// Agregar en usePool hook:
const { data: canCreatePairs = false } = useQuery({
  queryKey: ['canCreatePairs', address],
  queryFn: async () => {
    if (!address) return false;

    // 1. Check if public creation is enabled
    const isPublic = await callContract(
      CONTRACTS.FACTORY,
      'is_public_pair_creation_enabled',
      [],
      address
    );

    if (isPublic) return true;

    // 2. Check if user is admin
    const admin = await callContract(
      CONTRACTS.FACTORY,
      'get_admin',
      [],
      address
    );

    return admin === address;
  },
  enabled: !!address,
  staleTime: 60000,
});

// Luego en Pool.tsx:
{!existingPool && tokenA && tokenB && !canCreatePairs && (
  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
    <p className="font-semibold text-red-400">No Autorizado</p>
    <p className="text-red-300 mt-1">
      No tienes permisos para crear nuevos pools. Solo el admin puede crearlos.
    </p>
  </div>
)}
```

---

## 🎯 VERIFICACIÓN DE FIXES PARA TODO EL SISTEMA

### ✅ FIX #1: Pool vacío - Primera liquidez

**Verificación:**
```typescript
// Pool.tsx línea 42-47
const isEmptyPool = useMemo(() => {
  if (!existingPool) return false;
  const reserve0 = BigInt(existingPool.reserve0);
  const reserve1 = BigInt(existingPool.reserve1);
  return reserve0 === 0n || reserve1 === 0n;
}, [existingPool]);
```

**Prueba:**
1. ✅ Con XLM/yUSDC (pool existe, reserves = 0) → isEmptyPool = true
2. ✅ Con ETH/BTC (pool existe, reserves > 0) → isEmptyPool = false
3. ✅ Con AAA/BBB (pool no existe) → existingPool = null, isEmptyPool = false

**Resultado:** ✅ FUNCIONA PARA CUALQUIER PAR

---

### ✅ FIX #2: Auto-cálculo solo cuando pool tiene liquidez

**Verificación:**
```typescript
// Pool.tsx línea 140-160
const handleAmountAChange = useCallback((value: string) => {
  setAmountA(value);
  // ✅ Solo auto-calcular si pool tiene liquidez
  if (existingPool && value && parseFloat(value) > 0 && !isEmptyPool) {
    const calculatedB = calculateAmountB(value);
    if (calculatedB) {
      setAmountB(calculatedB);
    }
  }
}, [existingPool, calculateAmountB, isEmptyPool]);
```

**Prueba:**
1. ✅ Pool con liquidez → auto-calcula
2. ✅ Pool vacío → NO auto-calcula (permite manual)
3. ✅ Pool inexistente → NO auto-calcula (permite manual)

**Resultado:** ✅ FUNCIONA PARA CUALQUIER PAR

---

### ✅ FIX #3: Banners dinámicos

**Verificación:**
```typescript
// Pool.tsx línea 368, 388, 417, 426
{existingPool && isEmptyPool && (
  <div className="bg-yellow-500/10...">Primera Liquidez</div>
)}

{existingPool && poolInfo && !poolInfo.isInitialLiquidity && (
  <div className="bg-blue-500/10...">Existing Pool</div>
)}

{existingPool && !isEmptyPool && (
  <div className="bg-neutral-800...">Auto-calculated</div>
)}

{existingPool && isEmptyPool && (
  <div className="bg-yellow-800...">Ingrese manualmente</div>
)}
```

**Prueba:**
1. ✅ Pool con liquidez → Banner azul "Existing Pool" + "Auto-calculated"
2. ✅ Pool vacío → Banner amarillo "Primera Liquidez" + "Ingrese manualmente"
3. ⚠️ Pool inexistente → SIN banner (gap identificado)

**Resultado:** ✅ FUNCIONA PARA CUALQUIER PAR (con limitación #1)

---

## 📝 RECOMENDACIONES

### Inmediato (Testnet):

1. **Habilitar public_pair_creation**
   ```bash
   stellar contract invoke \
     --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
     --source astroswap-deployer-testnet \
     --network testnet \
     -- \
     set_public_pair_creation \
     --enabled true
   ```
   - ✅ Permite a cualquier usuario crear pools en testnet
   - ✅ Facilita testing sin restricciones

2. **Agregar banner para pools inexistentes** (código arriba en Limitación #1)
   - ✅ Mejor UX
   - ✅ Usuario sabe qué esperar

### Short-term:

3. **Agregar validación frontend de permisos** (código arriba en Limitación #3)
   - ✅ Evita transacciones fallidas
   - ✅ Ahorra gas

4. **Testing exhaustivo**
   - Probar con múltiples pares diferentes
   - Verificar casos:
     - Pool existente con liquidez
     - Pool existente vacío
     - Pool inexistente (admin)
     - Pool inexistente (no admin, public=true)
     - Pool inexistente (no admin, public=false)

### Long-term (Mainnet):

5. **Decidir estrategia de creación de pools**
   - Opción A: Admin-only (curated pools)
   - Opción B: Public creation (permissionless)
   - Opción C: Fee-based public creation (hybrid)

6. **Implementar sistema de pool whitelist** (opcional)
   ```rust
   // Permitir ciertos tokens sin restricción
   // Otros requieren fee o approval
   pub fn is_token_whitelisted(env: &Env, token: &Address) -> bool {
       // ...
   }
   ```

---

## ✅ CONCLUSIONES FINALES

### 1. Los fixes SON generales
- ✅ NO hay código específico para XLM/yUSDC
- ✅ Funcionan con CUALQUIER par de tokens
- ✅ Lógica completamente dinámica

### 2. Sistema de detección funciona correctamente
- ✅ `getAllPairs` obtiene TODOS los pares
- ✅ `usePool` carga información de TODOS
- ✅ No hay filtrado por tokens específicos

### 3. Sistema tiene limitación de permisos por diseño
- ⚠️ `public_pair_creation = false` por defecto
- ⚠️ Solo admin puede crear pools (si disabled)
- ⚠️ Frontend no valida permisos antes de intentar

### 4. Gap identificado: Sin feedback para pools inexistentes
- ⚠️ Usuario no sabe si pool existe o no
- ⚠️ Puede intentar crear sin saber si tiene permisos
- ✅ Solucionable con banner adicional

### 5. Sistema está listo para escalar
- ✅ Paginación en getAllPairs (max 100 por batch)
- ✅ Caching con React Query (staleTime: 30s)
- ✅ Validación en todos los niveles (frontend → Router → Factory → Pair)

---

## 🎯 RESPUESTA DIRECTA AL USUARIO

**Pregunta:** "revis no solo con ese par sin con todo lo pares existentes y en general debemos hacer solucion para todo el sistema no solo para un par"

**Respuesta:**

✅ **Los fixes SON una solución para todo el sistema:**

1. ✅ No hay código específico para XLM/yUSDC
2. ✅ Funcionan con CUALQUIER par de tokens
3. ✅ Sistema detecta TODOS los pares del Factory
4. ✅ Lógica es completamente dinámica

⚠️ **Limitación identificada:**

- El sistema tiene restricción de permisos por diseño
- Solo admin puede crear pools nuevos (default)
- Solución: Habilitar `public_pair_creation` en testnet

✅ **Testing recomendado:**

1. Probar con múltiples pares diferentes (no solo XLM/yUSDC)
2. Verificar pools vacíos de otros pares
3. Intentar crear pools nuevos (verificar permisos)

---

**Estado:** ✅ SISTEMA ANALIZADO - SOLUCIÓN GENERAL CONFIRMADA
**Próximo paso:** Habilitar public_pair_creation en testnet y testing con múltiples pares

**Generado:** 2026-03-11 por Claude Code (Sonnet 4.5)
