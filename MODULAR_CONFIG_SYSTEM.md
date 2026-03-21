# Sistema Modular de Configuración - AstroSwap

**Creado:** 2026-03-11
**Objetivo:** Sistema centralizado y modular para gestionar configuraciones entre testnet y mainnet

---

## 🎯 Filosofía del Sistema

**Problema anterior:**
```bash
# ❌ Comandos manuales, propensos a error
stellar contract invoke \
  --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  set_public_pair_creation \
  --enabled true
```

**Solución modular:**
```bash
# ✅ Un comando, todo automatizado
make config-testnet
```

---

## 📁 Estructura del Sistema

```
astro-swap/
├── configs/
│   ├── testnet.json        # Configuración permisiva (testing)
│   ├── mainnet.json        # Configuración restrictiva (producción)
│   └── README.md           # Documentación detallada
├── scripts/
│   ├── deploy.sh           # Deployment de contratos
│   └── configure.sh        # Configuración post-deployment
└── Makefile                # Comandos centralizados
```

---

## 🚀 Uso Rápido

### Opción 1: Configurar contratos existentes

```bash
# Testnet: Habilitar creación pública de pools
make config-testnet

# Mainnet: Deshabilitar creación pública de pools
make config-mainnet
```

### Opción 2: Deployment completo (deploy + config)

```bash
# Desplegar y configurar testnet en un solo comando
make deploy-and-config-testnet

# Desplegar y configurar mainnet en un solo comando
make deploy-and-config-mainnet
```

---

## 📊 Configuraciones por Red

### Testnet (`configs/testnet.json`)

```json
{
  "factory": {
    "public_pair_creation": true,   // ✅ Cualquiera puede crear pools
    "protocol_fee_bps": 30          // 0.30% fee (0.25% LP + 0.05% treasury)
  }
}
```

**Características:**
- ✅ Permisivo: cualquier usuario puede crear pools
- ✅ Ideal para testing sin restricciones
- ✅ Permite probar todo el flujo de creación

---

### Mainnet (`configs/mainnet.json`)

```json
{
  "factory": {
    "public_pair_creation": false,  // 🔒 Solo admin puede crear pools
    "protocol_fee_bps": 30
  }
}
```

**Características:**
- 🔒 Restrictivo: solo admin puede crear pools
- ✅ Previene spam de pools basura
- ✅ Control centralizado de liquidez

---

## 🔧 Targets del Makefile

### Deployment

```bash
make deploy-testnet         # Desplegar contratos a testnet
make deploy-mainnet         # Desplegar contratos a mainnet
```

### Configuración

```bash
make config-testnet         # Configurar testnet (public pools: true)
make config-mainnet         # Configurar mainnet (public pools: false)
```

### Deployment + Configuración (Todo en uno)

```bash
make deploy-and-config-testnet    # Desplegar y configurar testnet
make deploy-and-config-mainnet    # Desplegar y configurar mainnet
```

### Con variable NETWORK (avanzado)

```bash
make config NETWORK=testnet       # Equivalente a config-testnet
make deploy NETWORK=mainnet       # Equivalente a deploy-mainnet
```

---

## 📝 Ejemplo: Flujo Completo de Deployment

### 1. Deployment inicial

```bash
# Build, optimize y deploy contratos a testnet
make deploy-testnet
```

**Output:**
```
Building all contracts...
Optimizing WASM binaries...
Deploying to testnet...
✅ Factory deployed: CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T
✅ Router deployed: CA5AE63U6ZWRZWAPIIFTQSKDM45EQAYYWOIKN7MEQIJBYQAFAOPWLYYJ
```

### 2. Configuración post-deployment

```bash
# Aplicar configuración de testnet
make config-testnet
```

**Output:**
```
==========================================
   AstroSwap Configuration - testnet
==========================================

[INFO] Configuring Factory contract...
[INFO] Setting public_pair_creation to true...
[SUCCESS] public_pair_creation = true
[SUCCESS] Factory configured

Factory Settings:
  public_pair_creation: true
  protocol_fee_bps:     30

✅ Anyone can create pools on testnet

[SUCCESS] Configuration complete!
```

### 3. Verificación (opcional)

```bash
stellar contract invoke \
  --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  is_public_pair_creation_enabled
```

**Output esperado:**
```
true
```

---

## 🔄 Cambiar Configuración Existente

### Escenario: Deshabilitar creación pública en testnet

**1. Editar archivo de configuración**

```bash
# Editar configs/testnet.json
{
  "factory": {
    "public_pair_creation": false  // ← Cambiar de true a false
  }
}
```

**2. Aplicar cambios**

```bash
make config-testnet
```

**3. Verificar**

```bash
# Should return: false
stellar contract invoke \
  --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  is_public_pair_creation_enabled
```

---

## 🆕 Agregar Nuevas Configuraciones

### 1. Agregar setting al JSON

```json
{
  "factory": {
    "public_pair_creation": true,
    "protocol_fee_bps": 30,
    "min_trade_amount": "1000000"  // ← NUEVO
  }
}
```

### 2. Actualizar script `scripts/configure.sh`

```bash
configure_factory() {
    # ... código existente ...

    # Agregar nuevo setting
    local min_trade=$(jq -r '.factory.min_trade_amount' "${CONFIG_FILE}")

    if [ "$min_trade" != "null" ]; then
        info "Setting min_trade_amount to ${min_trade}..."
        stellar contract invoke \
            --id "${FACTORY_ID}" \
            --source "${DEPLOYER_KEY}" \
            --network "${NETWORK}" \
            -- \
            set_min_trade_amount \
            --amount "${min_trade}" 2>&1 | grep -v "^Transaction" || true
        success "min_trade_amount = ${min_trade}"
    fi
}
```

### 3. Documentar en `configs/README.md`

```markdown
## Settings Disponibles

- `public_pair_creation` (bool): Control de creación de pools
- `protocol_fee_bps` (int): Fee del protocolo en basis points
- `min_trade_amount` (string): Mínimo trade amount (nuevo)
```

---

## ✅ Beneficios del Sistema Modular

### 1. Centralización

```bash
# ❌ ANTES: Comandos manuales dispersos
stellar contract invoke --id ... --source ... --network ... -- set_public_pair_creation --enabled true
stellar contract invoke --id ... --source ... --network ... -- set_paused --paused false
# ... muchos más comandos ...

# ✅ AHORA: Un solo comando
make config-testnet
```

### 2. Consistencia

```bash
# Misma configuración siempre para misma red
make config-testnet   # Siempre aplica configs/testnet.json
make config-mainnet   # Siempre aplica configs/mainnet.json
```

### 3. Version Control

```bash
# Configuraciones trackeadas en Git
git log configs/testnet.json

# Rollback fácil
git checkout HEAD~1 configs/mainnet.json
make config-mainnet
```

### 4. Documentación como Código

```json
{
  "factory": {
    "public_pair_creation": true
  },
  "notes": {
    "public_pair_creation": "true = Anyone can create pools"  // ← Autodocumentado
  }
}
```

### 5. Switch Rápido entre Redes

```bash
# Cambiar de testnet a mainnet en segundos
make config-mainnet

# Volver a testnet
make config-testnet
```

---

## 🛡️ Seguridad

### Mainnet

- ⚠️ Solo el deployer (admin) puede ejecutar `make config-mainnet`
- ⚠️ Todos los cambios requieren firma del admin
- ⚠️ `public_pair_creation: false` por defecto (anti-spam)

### Testnet

- ✅ Seguro experimentar con cualquier configuración
- ✅ `public_pair_creation: true` recomendado (testing completo)
- ✅ Puede resetear en cualquier momento

---

## 🔍 Troubleshooting

### Error: "Config file not found"

```bash
# Verificar que el archivo existe
ls -la configs/testnet.json

# Si no existe, crearlo desde template
cp configs/mainnet.json configs/testnet.json
# Editar y ajustar settings
```

### Error: "Deployment file not found"

```bash
# Necesitas desplegar primero
make deploy-testnet

# Luego configurar
make config-testnet
```

### Error: "Deployer key not found"

```bash
# Verificar keys disponibles
stellar keys ls

# Si no existe, ejecutar deployment primero
make deploy-testnet
```

### Verificar configuración actual

```bash
# Manualmente invocar función de solo-lectura
stellar contract invoke \
  --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  is_public_pair_creation_enabled

# Debería devolver: true o false
```

---

## 📚 Documentación Adicional

- [`configs/README.md`](configs/README.md) - Documentación detallada de configuraciones
- [`scripts/configure.sh`](scripts/configure.sh) - Script de configuración comentado
- [`Makefile`](Makefile) - Todos los comandos disponibles (`make help`)

---

## 🎯 Resumen

**Sistema modular y centralizado que permite:**

✅ Cambiar entre testnet y mainnet con un comando
✅ Configuraciones trackeadas en Git (version control)
✅ Autodocumentación en JSON
✅ Rollback fácil a configuraciones anteriores
✅ Agregar nuevos settings sin modificar todo el sistema
✅ Prevenir errores de configuración manual

**Comandos principales:**
```bash
make config-testnet                # Configurar testnet
make config-mainnet                # Configurar mainnet
make deploy-and-config-testnet     # Deploy + config en uno
make deploy-and-config-mainnet     # Deploy + config en uno
```

---

**Status:** ✅ SISTEMA IMPLEMENTADO Y FUNCIONANDO
**Última actualización:** 2026-03-11
**Mantenedor:** AstroSwap Team
