# Checklist de Verificación Post-Fix

**Fecha:** 2026-03-11
**Fixes Aplicados:** Deadline 60 min + Filtro pools vacíos + SDK 14.6.1

---

## ✅ Paso 1: Verificar que el código nuevo está cargado

Abre DevTools Console y ejecuta:

```javascript
// Verificar deadline actual (debe ser ~3600 segundos = 60 min)
console.log('Deadline actual:', Math.floor(Date.now() / 1000) + (60 * 60));
```

**Esperado:** Ver timestamp ~3600 segundos en el futuro

---

## ✅ Paso 2: Verificar filtro de pools vacíos

En la consola, busca mensajes:

```
✅ CORRECTO:
"Skipping empty pool: CCNPS... (XLM/ASTRO)"
"Skipping empty pool: CDEUG... (XLM/yUSDC)"

❌ INCORRECTO:
"Pool has no liquidity yet - cannot calculate pool info"
```

**En la UI:**
- Los pools XLM/ASTRO y XLM/yUSDC NO deben aparecer en la lista
- Si todos los pools están vacíos, debe mostrar "No Pools Found"

---

## ✅ Paso 3: Probar agregar liquidez a nuevo pool

1. Click en "Add Liquidity"
2. Seleccionar tokens que **NO** tienen pool existente (ej: XLM/USDC nuevo)
3. Ingresar amounts (ej: 100 XLM, 10 USDC)
4. Aprobar tokens
5. Click "Add Liquidity"

**Verificar en consola:**
```
📊 Transaction parameters:
  deadline: [timestamp] ← DEBE SER ~3600 seg en futuro (60 min)
```

**Resultado esperado:**
- ✅ NO debe aparecer "Deadline has passed"
- ✅ Transacción debe completarse en <30 segundos
- ⚠️ Si aparece Error #203, continuar a Paso 4

---

## ✅ Paso 4: Si persiste Error #203 (MinimumNotMet)

**Esto indica que el contrato rechaza la primera liquidez.**

### Análisis del Error:

El error viene de esta validación en el contrato:

```rust
// pair/src/lib.rs (approx line 150)
if amount_0 < amount_0_min || amount_1 < amount_1_min {
    return Err(AstroSwapError::MinimumNotMet);
}
```

Para pools vacíos, los cálculos de `amount_min` con slippage fallan porque no hay ratio existente.

### Solución Temporal (Frontend):

Necesitamos deshabilitar slippage protection para primera liquidez.

**Modificar:** `frontend/src/hooks/usePool.ts`

```typescript
// Línea ~160
const rawAmountAMin = parseTokenAmount(
  (parseFloat(amountA) * slippageMultiplier).toString(),
  tokenA.decimals
);
const rawAmountBMin = parseTokenAmount(
  (parseFloat(amountB) * slippageMultiplier).toString(),
  tokenB.decimals
);
```

**Cambiar a:**

```typescript
// ✅ FIX: Disable slippage protection for first liquidity
// Check if pool exists and has liquidity
const poolExists = await getReserves(pairAddress, address);
const isFirstLiquidity = !poolExists ||
  (poolExists.reserve0 === '0' && poolExists.reserve1 === '0');

const rawAmountAMin = isFirstLiquidity
  ? '0'  // Accept any amount for first liquidity
  : parseTokenAmount(
      (parseFloat(amountA) * slippageMultiplier).toString(),
      tokenA.decimals
    );

const rawAmountBMin = isFirstLiquidity
  ? '0'  // Accept any amount for first liquidity
  : parseTokenAmount(
      (parseFloat(amountB) * slippageMultiplier).toString(),
      tokenB.decimals
    );
```

### Solución Permanente (Contrato):

Modificar el contrato para permitir amounts_min = 0 cuando el pool está vacío:

```rust
// En pair/src/lib.rs
let is_first_liquidity = reserve_0 == 0 && reserve_1 == 0;

if !is_first_liquidity {
    if amount_0 < amount_0_min || amount_1 < amount_1_min {
        return Err(AstroSwapError::MinimumNotMet);
    }
}
```

---

## 🎯 Resumen de Verificación

- [ ] Cache limpiado (hard refresh o rm -rf .vite)
- [ ] Console muestra "Skipping empty pool" (no "Pool has no liquidity")
- [ ] Pools vacíos NO aparecen en lista de UI
- [ ] Deadline es 60 min (~3600 seg)
- [ ] Error "Deadline expired" resuelto ✅
- [ ] Error #203 resuelto (o aplicar fix adicional)

---

**Status Actual:** ✅ Fixes aplicados - ESPERANDO VERIFICACIÓN DEL USUARIO

**Próximo Paso:** Si Error #203 persiste después de cache clear, aplicar fix de slippage protection
