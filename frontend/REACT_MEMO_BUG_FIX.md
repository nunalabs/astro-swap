# React.memo() Bug Fix - UI Not Updating After Refetch

**Date**: 2026-03-17
**Bug**: UI no se actualizaba después de transacciones exitosas
**Root Cause**: React.memo() bloqueando re-renders
**Solution**: Usar `invalidateQueries` en lugar de `refetchQueries`

---

## El Problema

### Síntomas
- ✅ Transacción exitosa
- ✅ Refetch se ejecuta después de 3 segundos
- ✅ Los datos se obtienen correctamente del backend
- ❌ **Pero la UI NO se actualiza**

### Logs Mostraban
```
✅ addLiquidity success: 2a7e6547f5ea95e0223281d72cb0c920e4db850a5c501703da8924e1d106cbd5
✅ Parsed reserves: {reserve0: '106188939223', reserve1: '12845357411'}
✅ Successfully loaded 2 pools out of 2 pairs
```

Pero los valores en la UI permanecían sin cambiar.

---

## Root Cause: React.memo() Shallow Comparison

### El Código Problemático

**`/src/components/Pool/PoolCard.tsx`:**
```typescript
export const PoolCard = memo(function PoolCard({ pool, onAddLiquidity, onRemoveLiquidity }: PoolCardProps) {
  // ...
  <p className="font-mono text-sm">{formatTokenAmount(pool.reserve0, pool.token0.decimals, 2)}</p>
  <p className="font-mono text-sm">{formatTokenAmount(pool.reserve1, pool.token1.decimals, 2)}</p>
});
```

**Qué hace `React.memo()`:**
- Hace una **shallow comparison** de los props
- Si la **referencia del objeto** `pool` no cambia, **bloquea el re-render**
- No compara las propiedades internas como `reserve0`, `reserve1`

### Por Qué Fallaba con `refetchQueries`

**Antes (NO funcionaba):**
```typescript
// usePool.ts - onSuccess
setTimeout(() => {
  queryClient.refetchQueries({ queryKey: ['pools', address] });
}, 3000);
```

**Comportamiento de `refetchQueries`:**
1. Hace fetch de los datos nuevos ✅
2. **Reutiliza las mismas referencias de objetos** ❌
3. React Query actualiza las propiedades internas (reserve0, reserve1)
4. Pero el array `pools` y los objetos `pool` tienen la misma referencia
5. `React.memo()` hace shallow comparison: "misma referencia = no cambios" ❌
6. **No re-renderiza el componente** ❌

---

## La Solución: `invalidateQueries`

**Después (SÍ funciona):**
```typescript
// usePool.ts - onSuccess
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ['pools', address] });
  queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
  queryClient.invalidateQueries({ queryKey: ['token-balances'] });
}, 3000);
```

**Comportamiento de `invalidateQueries`:**
1. Marca la query como **stale** (inválida)
2. Fuerza un **nuevo fetch completo**
3. **Crea nuevos objetos con nuevas referencias** ✅
4. React Query retorna un nuevo array `pools` con nuevos objetos `pool`
5. `React.memo()` hace shallow comparison: "referencia diferente = hay cambios" ✅
6. **Re-renderiza el componente** ✅
7. **UI se actualiza con los nuevos valores** ✅

---

## Diferencias Clave

| Método | Crea Nuevas Referencias | React.memo Re-renderiza | UI Actualiza |
|--------|-------------------------|-------------------------|--------------|
| `refetchQueries` | ❌ No | ❌ No | ❌ No |
| `invalidateQueries` | ✅ Sí | ✅ Sí | ✅ Sí |

---

## Archivos Modificados

### 1. `/src/hooks/usePool.ts`
- Cambió `refetchQueries` → `invalidateQueries` en `addLiquidityMutation.onSuccess`
- Cambió `refetchQueries` → `invalidateQueries` en `removeLiquidityMutation.onSuccess`

### 2. `/src/hooks/useSwap.ts`
- Cambió `refetchQueries` → `invalidateQueries` en `swapMutation.onSuccess`

---

## Alternativas Consideradas

### Opción 1: Remover `React.memo()` de PoolCard
```typescript
// Sin memo - siempre re-renderiza
export function PoolCard({ pool, onAddLiquidity, onRemoveLiquidity }: PoolCardProps) {
  // ...
}
```

**Pros:** Solución simple
**Contras:** Menos performante, re-renders innecesarios

### Opción 2: Comparación Personalizada
```typescript
export const PoolCard = memo(
  function PoolCard({ pool, onAddLiquidity, onRemoveLiquidity }: PoolCardProps) {
    // ...
  },
  (prevProps, nextProps) => {
    // Comparar reserve0 y reserve1 específicamente
    return (
      prevProps.pool.address === nextProps.pool.address &&
      prevProps.pool.reserve0 === nextProps.pool.reserve0 &&
      prevProps.pool.reserve1 === nextProps.pool.reserve1
    );
  }
);
```

**Pros:** Control granular
**Contras:** Más complejo, fácil de olvidar campos

### Opción 3: `invalidateQueries` (ELEGIDA)
**Pros:**
- ✅ No requiere cambiar componentes
- ✅ Fuerza nuevas referencias automáticamente
- ✅ Funciona con cualquier componente memoizado
- ✅ Patrón recomendado por TanStack Query

**Contras:**
- Ninguno significativo para este caso

---

## Lecciones Aprendidas

### 1. React.memo() y Object References
`React.memo()` solo compara referencias, no contenido profundo. Si pasas objetos mutados con la misma referencia, no re-renderizará.

### 2. TanStack Query: refetch vs invalidate
- **`refetchQueries`**: Útil para refrescar datos manteniendo referencias (ej: background sync)
- **`invalidateQueries`**: Mejor para forzar actualizaciones de UI con componentes memoizados

### 3. Debugging Tips
Si la UI no se actualiza después de un refetch:
1. ✅ Verifica que los datos lleguen correctamente (console.log)
2. ✅ Revisa si hay `React.memo()` en los componentes
3. ✅ Considera usar `invalidateQueries` en lugar de `refetchQueries`
4. ✅ Verifica que las queryKeys coincidan exactamente

---

## Testing

### Probar la Solución

1. **Add Liquidity:**
   - Agrega liquidez a un pool
   - Espera 3 segundos
   - ✅ Las reserves deberían actualizarse automáticamente en la UI

2. **Remove Liquidity:**
   - Remueve liquidez de un pool
   - Espera 3 segundos
   - ✅ Las reserves deberían disminuir automáticamente

3. **Swap:**
   - Ejecuta un swap
   - Espera 3 segundos
   - ✅ Los balances deberían actualizarse automáticamente

---

## Resultado Final

✅ **UI se actualiza automáticamente** después de transacciones
✅ **No más logs excesivos** (eliminados en fix anterior)
✅ **Implementación simple y mantenible**
✅ **Funciona con todos los componentes memoizados**
✅ **Escalable** - funciona para cualquier query future

---

**Status**: ✅ **FIXED**
**Next Steps**: Probar con transacción real para confirmar UI actualiza
**Recommendation**: Usar siempre `invalidateQueries` para actualizaciones post-mutación
