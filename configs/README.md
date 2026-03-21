# AstroSwap - Network Configuration

Este directorio contiene archivos de configuración específicos por red para el sistema AstroSwap.

## 📁 Archivos

- `testnet.json` - Configuración permisiva para testing
- `mainnet.json` - Configuración restrictiva para producción

## 🎯 Filosofía

**Sistema modular y centralizado** que permite cambiar fácilmente entre testnet y mainnet:

```bash
# Testnet: permisivo, cualquiera puede crear pools
make config-testnet

# Mainnet: restrictivo, solo admin puede crear pools
make config-mainnet
```

## 📋 Estructura de Configuración

```json
{
  "network": "testnet",
  "factory": {
    "public_pair_creation": true,    // true = anyone, false = admin-only
    "protocol_fee_bps": 30,          // 30 bps = 0.30% (0.25% LP + 0.05% treasury)
    "paused": false                   // Emergency pause switch
  },
  "router": {
    "paused": false
  },
  "staking": {
    "paused": false
  }
}
```

## 🚀 Uso

### Opción 1: Configurar contratos ya desplegados

```bash
# Configurar testnet (habilita creación pública de pools)
make config-testnet

# Configurar mainnet (deshabilita creación pública de pools)
make config-mainnet
```

### Opción 2: Desplegar + configurar en un solo comando

```bash
# Desplegar y configurar testnet
make deploy-and-config-testnet

# Desplegar y configurar mainnet
make deploy-and-config-mainnet
```

### Opción 3: Manual con variable NETWORK

```bash
# Configurar red específica
make config NETWORK=testnet
make config NETWORK=mainnet
```

## 🔍 Diferencias entre Redes

### Testnet (`testnet.json`)

```json
{
  "factory": {
    "public_pair_creation": true   // ✅ Cualquiera puede crear pools
  }
}
```

**Características:**
- ✅ Cualquier usuario puede crear pools nuevos
- ✅ Ideal para testing sin restricciones
- ✅ Permite probar flujo completo de creación de pools
- ⚠️ Puede generar pools spam (no es problema en testnet)

**Casos de uso:**
- Testing de UI/UX
- Desarrollo de features
- Demos
- Educación

---

### Mainnet (`mainnet.json`)

```json
{
  "factory": {
    "public_pair_creation": false  // 🔒 Solo admin puede crear pools
  }
}
```

**Características:**
- 🔒 Solo el admin puede crear pools
- ✅ Control centralizado de qué pools existen
- ✅ Previene spam de pools basura
- ✅ Concentra liquidez en pools oficiales

**Casos de uso:**
- Producción
- Pools curados
- Anti-spam
- Gestión de liquidez centralizada

## 🔧 Cómo Funciona

### 1. Script de configuración (`scripts/configure.sh`)

El script:
1. Lee el archivo de configuración (ej: `configs/testnet.json`)
2. Carga las direcciones de contratos de `.deployed/deployment.testnet.json`
3. Aplica cada configuración llamando a los contratos:
   ```bash
   stellar contract invoke \
     --id $FACTORY_ID \
     --source $DEPLOYER_KEY \
     --network testnet \
     -- \
     set_public_pair_creation \
     --enabled true
   ```
4. Verifica que la configuración se aplicó correctamente

### 2. Validación automática

El script verifica cada setting después de aplicarlo:
```bash
stellar contract invoke \
  --id $FACTORY_ID \
  -- \
  is_public_pair_creation_enabled
```

Si el valor no coincide, falla con error.

### 3. Logs claros

```
[INFO] Configuring Factory contract...
[INFO] Setting public_pair_creation to true...
[SUCCESS] public_pair_creation = true
[SUCCESS] Factory configured
```

## 📝 Agregar Nuevas Configuraciones

### 1. Agregar setting al archivo JSON

```json
{
  "factory": {
    "public_pair_creation": true,
    "protocol_fee_bps": 30,
    "min_trade_amount": "1000000"  // ← NUEVO
  }
}
```

### 2. Agregar lógica al script `configure.sh`

```bash
configure_factory() {
    # ... código existente ...

    # Nuevo setting
    local min_trade=$(jq -r '.factory.min_trade_amount' "${CONFIG_FILE}")
    info "Setting min_trade_amount to ${min_trade}..."
    stellar contract invoke \
        --id "${FACTORY_ID}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        set_min_trade_amount \
        --amount "${min_trade}"
    success "min_trade_amount = ${min_trade}"
}
```

### 3. Agregar validación

```bash
verify_configuration() {
    # ... código existente ...

    # Verificar nuevo setting
    info "Checking Factory.get_min_trade_amount()..."
    local actual_min_trade=$(stellar contract invoke \
        --id "${FACTORY_ID}" \
        -- \
        get_min_trade_amount 2>&1 | tail -1)

    local expected_min_trade=$(jq -r '.factory.min_trade_amount' "${CONFIG_FILE}")

    if [ "${actual_min_trade}" == "${expected_min_trade}" ]; then
        success "Factory.min_trade_amount = ${actual_min_trade} ✓"
    else
        error "Mismatch! Expected: ${expected_min_trade}, Actual: ${actual_min_trade}"
    fi
}
```

## 🎯 Casos de Uso

### Caso 1: Primera configuración después de deployment

```bash
# Desplegar contratos
make deploy-testnet

# Configurar con settings de testnet
make config-testnet
```

### Caso 2: Cambiar configuración de testnet existente

```bash
# Editar configs/testnet.json
# Cambiar public_pair_creation de true a false

# Aplicar cambios
make config-testnet
```

### Caso 3: Emergency pause

```bash
# Editar configs/mainnet.json
{
  "factory": {
    "paused": true  // ← Activar emergency pause
  }
}

# Aplicar
make config-mainnet
```

### Caso 4: Deployment completo (deploy + config)

```bash
# Todo en un comando
make deploy-and-config-testnet

# O para mainnet
make deploy-and-config-mainnet
```

## ⚙️ Prerrequisitos

El script `configure.sh` requiere:

1. **Stellar CLI** instalado
   ```bash
   cargo install stellar-cli
   ```

2. **jq** para parsear JSON
   ```bash
   # macOS
   brew install jq

   # Linux
   apt-get install jq
   ```

3. **Contratos desplegados**
   - Debe existir `.deployed/deployment.{network}.json`
   - Debe existir la key del deployer: `astroswap-deployer-{network}`

4. **Permisos de admin**
   - Solo el deployer (admin) puede cambiar configuraciones

## 🔐 Seguridad

### Mainnet

- ⚠️ **NUNCA** habilites `public_pair_creation: true` en mainnet sin considerar riesgos
- ⚠️ Solo el deployer puede ejecutar `make config-mainnet`
- ✅ Todos los cambios requieren firma del admin

### Testnet

- ✅ Seguro habilitar cualquier setting
- ✅ Usa para testing de features nuevas
- ✅ Puedes resetear en cualquier momento

## 📊 Verificar Configuración Actual

```bash
# Ver config actual del Factory en testnet
stellar contract invoke \
  --id CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T \
  --source astroswap-deployer-testnet \
  --network testnet \
  -- \
  is_public_pair_creation_enabled

# Resultado: true o false
```

## 🎓 Mejores Prácticas

1. **Siempre usa archivos de configuración** - No ejecutes comandos manuales
2. **Version control** - Commitea cambios a configs/
3. **Testing primero** - Prueba en testnet antes de mainnet
4. **Documentación** - Agrega notes en JSON explicando cambios
5. **Backup** - Guarda configuración anterior antes de cambiar

## 🔄 Rollback

Si necesitas revertir cambios:

```bash
# 1. Restaurar archivo de configuración anterior
git checkout HEAD~1 configs/mainnet.json

# 2. Aplicar configuración anterior
make config-mainnet
```

---

**Mantenido por:** AstroSwap Team
**Última actualización:** 2026-03-11
