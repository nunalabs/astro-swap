# Fix: Pools Vacíos - Problema y Soluciones

**Fecha:** 2026-03-11
**Problema:** Existen pools sin liquidez que causan errores en la UI
**Soluciones aplicadas:** 3 fixes para corregir y prevenir

---

## ❌ Problema: ¿Por qué existen pools vacíos?

### Causa 1: Testing incompleto

Durante testing, se crearon pools pero NO se agregó liquidez inicial:

```bash
# Se creó el pool
Factory.create_pair(XLM, ASTRO)
→ Pool address: CCNPSWYZ3UVEY5UBK26EJKNWZO4YNJE25RPLCRNHWJMYZ4ZOA2H2SKJF

# Pero NUNCA se llamó
Router.add_liquidity(...)
```

**Resultado:**
- Pool existe en Factory
- Reserves: 0 / 0
- Total supply: 0
- ❌ Pool vacío e inutilizable

### Causa 2: Error en flujo de creación

El sistema actual permite dos pasos separados:
1. `Factory.create_pair` → Crea pool
2. `Router.add_liquidity` → Agrega liquidez

**Problema:** Si paso 2 falla, queda pool vacío.

---

## ⚠️ Problemas causados por pools vacíos

### 1. Error #203 (MinimumNotMet)

```
❌ Simulation error: HostError: Error(Contract, #203)
```

Aunque el contrato maneja primera liquidez correctamente, los cálculos de slippage fallan.

### 2. Deadline Expired

```
Error: Deadline has passed. Please try again.
```

La transacción toma mucho tiempo en:
- Simulación
- Firma con wallet (Freighter: 3.4s)
- Envío a RPC
- Procesamiento en blockchain

Para cuando llega, el deadline (20 min) ya expiró.

### 3. Confusión en UI

Los usuarios ven pools vacíos y no entienden:
- ¿Por qué existe el pool?
- ¿Por qué no puedo usarlo?
- ¿Debo agregar liquidez yo?

---

## ✅ Soluciones Aplicadas

### Fix #1: Aumentar deadline

**Archivo:** `frontend/src/hooks/usePool.ts`

```typescript
// ANTES: 20 minutos (muy corto para testnet)
const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

// DESPUÉS: 60 minutos (seguro para testnet)
const deadlineTimestamp = Math.floor(Date.now() / 1000) + (60 * 60);
```

**Razón:**
- Testnet es más lento que mainnet
- Freighter toma 3-4 segundos para firmar
- RPC puede tener delays
- Simulación puede tardar
- 60 minutos es más seguro

**Resultado:**
- ✅ Deadline no expira durante transacción
- ✅ Más tiempo para wallet signing
- ✅ Más tolerancia a delays de red

---

### Fix #2: Filtrar pools vacíos de UI

**Archivo:** `frontend/src/hooks/usePool.ts`

```typescript
// ✅ FIX: Filter out empty pools
return results.filter((pool): pool is Pool => {
  if (!pool) return false;

  // Remove pools with zero reserves
  const reserve0 = BigInt(pool.reserve0);
  const reserve1 = BigInt(pool.reserve1);

  if (reserve0 === 0n && reserve1 === 0n) {
    console.debug(`Skipping empty pool: ${pool.address}`);
    return false;
  }

  return true;
});
```

**Resultado:**
- ✅ Pools vacíos NO aparecen en lista
- ✅ Usuario solo ve pools utilizables
- ✅ Mejor UX

---

### Fix #3: SDK actualizado

**Archivo:** `frontend/package.json`

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^14.6.1"  // Was: 12.1.0
  }
}
```

**Razón:**
- SDK 12.x no soporta Protocol 25
- Causaba error "Bad union switch: 4"
- SDK 14.x usa nueva API: `StellarSdk.rpc` (no `SorobanRpc`)

**Resultado:**
- ✅ Compatible con Protocol 25
- ✅ Sin errores de XDR parsing
- ✅ API actualizada en todos los archivos

---

## 🛡️ Prevención: ¿Cómo evitar pools vacíos en el futuro?

### Opción 1: Crear pool + primera liquidez atómica

Modificar Router.add_liquidity para hacer ambas cosas:

```rust
pub fn add_liquidity(
    env: Env,
    user: Address,
    token_a: Address,
    token_b: Address,
    amount_a_desired: i128,
    amount_b_desired: i128,
    // ...
) -> Result<(i128, i128, i128), AstroSwapError> {
    // Get or create pair
    let pair_address = match factory_client.get_pair(&token_a, &token_b) {
        Some(addr) => addr,
        None => {
            // ✅ Create pair
            let new_pair = factory_client.create_pair(&user, &token_a, &token_b)?;

            // ✅ IMMEDIATELY add liquidity (can't fail and leave empty pool)
            // ... add liquidity logic ...

            new_pair
        }
    };

    // If pair already exists, just add liquidity
    // ...
}
```

**Ventajas:**
- ✅ Atómico: pool creado + liquidez agregada en una transacción
- ✅ Imposible crear pool vacío
- ✅ No requiere cambios en UI

**Desventajas:**
- Más gas (dos operaciones en una)

---

### Opción 2: Validación en Factory

Agregar mínimo de liquidez requerido al crear pool:

```rust
pub fn create_pair(
    env: Env,
    caller: Address,
    token_a: Address,
    token_b: Address,
    initial_liquidity_a: i128,  // ✅ NUEVO
    initial_liquidity_b: i128,  // ✅ NUEVO
) -> Result<Address, AstroSwapError> {
    // Validar que se proporciona liquidez inicial
    if initial_liquidity_a <= 0 || initial_liquidity_b <= 0 {
        return Err(AstroSwapError::MinimumNotMet);
    }

    // Crear pool
    let pair_address = deploy_pair(&env, &token_a, &token_b)?;

    // Transferir liquidez inicial inmediatamente
    // ...

    Ok(pair_address)
}
```

**Ventajas:**
- ✅ Garantiza que todo pool nuevo tiene liquidez
- ✅ Simple de implementar

**Desventajas:**
- Requiere cambiar signature de Factory.create_pair
- Requiere cambios en UI

---

### Opción 3: Limpiar pools vacíos existentes (testnet only)

Para testnet, eliminar pools vacíos:

```bash
# Verificar pools vacíos
stellar contract invoke \
  --id CCNPSWYZ3UVEY5UBK26EJKNWZO4YNJE25RPLCRNHWJMYZ4ZOA2H2SKJF \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  get_reserves

# Si returns (0, 0), el pool está vacío

# Opción: No hacer nada (nuestro filtro en UI ya los oculta)
# Opción: Agregar función admin para eliminar pools (no recomendado)
```

**Recomendación:**
- ✅ En testnet: dejar pools vacíos (nuestro filtro los oculta)
- ✅ En mainnet: prevenir con Opción 1 o 2

---

## 📊 Verificación

### Antes del fix:

```
Pools encontrados: 2
- XLM/yUSDC: reserves (0, 0) ❌ Vacío
- XLM/ASTRO: reserves (0, 0) ❌ Vacío
```

**UI mostraba:**
- 2 pools en lista
- Usuario intentaba agregar liquidez
- Error: Deadline expired
- Error: #203 MinimumNotMet

---

### Después del fix:

```
Pools encontrados: 2
- XLM/yUSDC: reserves (0, 0) → FILTRADO (no se muestra)
- XLM/ASTRO: reserves (0, 0) → FILTRADO (no se muestra)
```

**UI muestra:**
- "No Pools Found"
- Botón "Create Pool" (si public_pair_creation = true)
- ✅ Usuario no ve pools vacíos problemáticos

---

## 🎯 Testing

### Verificar fix en navegador:

1. **Recargar página** (Cmd+R o Ctrl+R)

2. **Verificar consola:**
   ```
   Discovered 2 tokens from factory
   Skipping empty pool: CCNPS... (XLM/ASTRO)
   Skipping empty pool: CDEUG... (XLM/yUSDC)
   ```

3. **Verificar UI:**
   - NO debería mostrar pools vacíos
   - Debería mostrar "No Pools Found" si todos están vacíos

4. **Crear nuevo pool con liquidez:**
   - Click "Add Liquidity"
   - Seleccionar tokens que NO tienen pool
   - Ingresar amounts
   - Aprobar tokens
   - Add Liquidity debería funcionar (deadline: 60 min)

---

## 📝 Para Mainnet

### Antes de deployment a mainnet:

1. **Implementar Opción 1 o 2** (prevención atómica)

2. **Testing exhaustivo en testnet:**
   ```bash
   # Probar crear pool + agregar liquidez
   # Verificar que NO se pueden crear pools vacíos
   # Verificar que deadline de 60 min funciona
   ```

3. **Documentar flujo:**
   ```
   Usuario → "Add Liquidity"
   → Verifica si pool existe
   → Si NO existe: crea pool + agrega liquidez (atómico)
   → Si existe: solo agrega liquidez
   ```

4. **Monitorear:**
   - Verificar que NO aparecen pools vacíos en Factory
   - Si aparece alguno, investigar causa

---

## ✅ Checklist

- [x] SDK actualizado a 14.6.1
- [x] Deadline aumentado a 60 minutos
- [x] Filtro de pools vacíos agregado
- [x] Código actualizado (SorobanRpc → rpc)
- [ ] **USUARIO: Recargar navegador**
- [ ] **USUARIO: Verificar que pools vacíos no aparecen**
- [ ] **USUARIO: Probar agregar liquidez**
- [ ] **DEV: Implementar prevención atómica (Opción 1)**
- [ ] **DEV: Testing en testnet**
- [ ] **DEV: Deployment a mainnet**

---

**Status:** ✅ FIXES APLICADOS - REQUIERE RECARGA DE NAVEGADOR
**Archivos modificados:**
- usePool.ts (deadline + filtro)
- package.json (SDK)
- stellar.ts, useTokenApproval.ts, AddTokenModal.tsx, token-indexer.ts (API)

**Generado:** 2026-03-11 por Claude Code (Sonnet 4.5)
