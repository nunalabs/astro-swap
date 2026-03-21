# AstroSwap - Fixes Aplicados para Producción Testnet

**Fecha**: 2026-03-16
**Objetivo**: Preparar astro-swap para deployment production-ready en testnet
**Status**: ✅ Fixes Completos - Pendiente Build & Deploy

---

## Cambios Implementados

### 1. ✅ FIX: Deployment Script - CAP-58 Constructor Pattern

**Problema**: El script `scripts/deploy.sh` usaba patrón legacy `initialize()` que falla con error `AlreadyInitialized` porque los contratos usan CAP-58 `__constructor`.

**Archivo modificado**: `scripts/deploy.sh`

#### Cambios principales:

1. **Eliminadas funciones legacy**:
   - `initialize_factory()`
   - `initialize_router()`
   - `initialize_staking()`
   - `initialize_aggregator()`

2. **Nuevas funciones**:
   ```bash
   # Install WASM sin deployar
   install_wasm() {
       # Instala WASM y retorna hash
   }

   # Deploy con constructor args (CAP-58)
   deploy_with_constructor() {
       stellar contract deploy \
           --wasm-hash "${wasm_hash}" \
           -- \
           "${constructor_args[@]}"
   }
   ```

3. **Deployment flow actualizado**:
   ```bash
   # Factory con constructor
   FACTORY_ID=$(deploy_with_constructor "factory" "${FACTORY_HASH}" \
       --admin "${DEPLOYER_ADDRESS}" \
       --pair_wasm_hash "${PAIR_HASH}" \
       --protocol_fee_bps 30)

   # Router con constructor
   ROUTER_ID=$(deploy_with_constructor "router" "${ROUTER_HASH}" \
       --factory "${FACTORY_ID}" \
       --admin "${DEPLOYER_ADDRESS}")

   # Staking con constructor
   STAKING_ID=$(deploy_with_constructor "staking" "${STAKING_HASH}" \
       --admin "${DEPLOYER_ADDRESS}" \
       --reward_token "${REWARD_TOKEN}")

   # Aggregator con constructor
   AGGREGATOR_ID=$(deploy_with_constructor "aggregator" "${AGGREGATOR_HASH}" \
       --admin "${DEPLOYER_ADDRESS}" \
       --astroswap_factory "${FACTORY_ID}")
   ```

4. **Fix BUILD_DIR path**:
   ```bash
   # ANTES (❌ incorrecto)
   BUILD_DIR="target/wasm32v1-none/release"

   # DESPUÉS (✅ correcto - coincide con Makefile)
   BUILD_DIR="target/wasm32-unknown-unknown/release"
   ```

---

### 2. ✅ FIX: Contract Tests - CAP-58 Compatible

**Status**: Tests ya estaban correctos

**Verificación**: `contracts/pair/src/tests.rs` (líneas 24-37)

```rust
// Helper ya usa constructor args correctamente
fn register_pair<'a>(
    env: &'a Env,
    factory: &Address,
    token_0: &Address,
    token_1: &Address,
) -> AstroSwapPairClient<'a> {
    let pair_addr = env.register(
        AstroSwapPair,
        (factory.clone(), token_0.clone(), token_1.clone()),
    );
    AstroSwapPairClient::new(env, &pair_addr)
}
```

**Contratos sin tests unitarios**: Router, Factory (solo tienen tests en `tests/e2e/`)

---

### 3. ✅ FIX: Primera Liquidez - Comentarios Mejorados

**Archivo modificado**: `contracts/pair/src/contract.rs` (líneas 228-251)

**Mejora**: Comentarios clarificados para explicar que primera liquidez NO requiere slippage protection.

**Frontend ya correcto**: `frontend/src/hooks/usePool.ts` (líneas 189-200)

```typescript
// ✅ Ya implementado correctamente
const rawAmountAMin = isFirstLiquidity
  ? '0'  // No slippage protection for first liquidity
  : parseTokenAmount(
      (parseFloat(amountA) * slippageMultiplier).toString(),
      tokenA.decimals
    );

const rawAmountBMin = isFirstLiquidity
  ? '0'  // No slippage protection for first liquidity
  : parseTokenAmount(
      (parseFloat(amountB) * slippageMultiplier).toString(),
      tokenB.decimals
    );
```

---

## Próximos Pasos

### Build & Optimize

```bash
cd astro-swap
make build        # Compila todos los contratos
make optimize     # Optimiza WASMs con stellar CLI
```

### Deploy a Testnet

```bash
make deploy-testnet
# Ejecuta: scripts/deploy.sh testnet
```

**Output esperado**:
```
Contract IDs:
  Factory:    CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  Router:     CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  Staking:    CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  Aggregator: CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Actualizar Frontend .env

Copiar contract IDs al archivo `.deployed/deployment.testnet.json` → `frontend/.env`:

```bash
VITE_FACTORY_CONTRACT_ID=<factory_id>
VITE_ROUTER_CONTRACT_ID=<router_id>
VITE_STAKING_CONTRACT_ID=<staking_id>
```

### Verificación End-to-End

1. **Start frontend**:
   ```bash
   cd frontend && pnpm dev
   ```

2. **Test flow**:
   - Conectar wallet (Freighter)
   - Crear nuevo pool (XLM/USDC)
   - Agregar primera liquidez
   - Agregar liquidez subsecuente
   - Realizar swap
   - Remover liquidez

---

## Archivos Modificados

```
astro-swap/
├── scripts/deploy.sh                     # ✅ CAP-58 constructor pattern
├── contracts/pair/src/contract.rs        # ✅ Comentarios mejorados
└── PRODUCTION_FIXES_2026-03-16.md        # 📄 Este documento
```

---

## Checklist Pre-Deploy

- [x] Deployment script corregido (CAP-58)
- [x] BUILD_DIR path corregido
- [x] Tests verificados (CAP-58 compatible)
- [x] Primera liquidez edge case documentado
- [ ] Build completo exitoso
- [ ] Optimize WASMs
- [ ] Deploy a testnet
- [ ] Update frontend .env
- [ ] E2E verification

---

## Notas Técnicas

### Constructors por Contrato

| Contrato | Constructor Args |
|----------|-----------------|
| Factory | `admin, pair_wasm_hash, protocol_fee_bps` |
| Router | `factory, admin` |
| Staking | `admin, reward_token` |
| Aggregator | `admin, astroswap_factory` |
| Pair | `factory, token_0, token_1` (usado por factory) |

### Configuración Testnet

Según `configs/testnet.json`:
- `public_pair_creation`: true (cualquiera puede crear pools)
- `protocol_fee_bps`: 30 (0.30% total: 0.25% LP + 0.05% protocol)
- `paused`: false

---

**Responsable**: Claude Code
**Review**: Pendiente usuario
**Deploy**: Pendiente build success
