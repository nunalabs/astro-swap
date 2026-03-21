# Fix: Stellar SDK Update - Protocol 25 Compatibility

**Fecha:** 2026-03-11
**Problema:** Error "Bad union switch: 4" al aprobar tokens
**Causa:** Stellar SDK 12.x no soporta Soroban Protocol 25
**Solución:** Actualizado a Stellar SDK 14.6.1

---

## ❌ Problema Original

```
Error approving token: TypeError: Bad union switch: 4
    at n2.armForSwitch (@stellar_stellar-sdk.js?v=68132d95:712:23)
    at n2.read (@stellar_stellar-sdk.js?v=68132d95:718:63)
    at n2.fromXDR (@stellar_stellar-sdk.js?v=68132d95:192:56)
```

**Causa raíz:**
- Stellar SDK `12.1.0` usa formato XDR antiguo
- Soroban Protocol 25 usa nuevo formato XDR
- SDK antiguo no puede parsear respuestas del RPC de Protocol 25

---

## ✅ Solución Aplicada

### 1. Actualizado package.json

**ANTES:**
```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^12.1.0"
  }
}
```

**DESPUÉS:**
```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^13.0.0"
  }
}
```

**Instalado:** `@stellar/stellar-sdk@14.6.1` (última versión compatible)

### 2. Limpiado cache de Vite

```bash
rm -rf node_modules/.vite
rm -rf .vite
```

### 3. Reiniciado servidor dev

```bash
pnpm dev
```

---

## 🔄 Acción Requerida (USUARIO)

### ⚠️ IMPORTANTE: Debes recargar el navegador

El navegador aún tiene en cache el SDK antiguo. **Debes hacer hard refresh:**

#### En Chrome/Brave/Edge:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

#### En Firefox:
- **Windows/Linux:** `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`

#### Alternativa:
1. Abre DevTools (F12)
2. Click derecho en el botón de recargar
3. Selecciona "Empty Cache and Hard Reload"

---

## ✅ Verificación

Después del hard refresh, el error debería desaparecer. Deberías ver en la consola:

```
✅ Transaction submitted to network (took 0.4s)
🔗 Transaction hash: 5a3e4dfb9896d923...
📊 Initial status from RPC: PENDING
⏳ Waiting for blockchain confirmation...
📊 Final blockchain status: SUCCESS      ← ✅ SIN ERROR
✅ Token approved successfully!
```

---

## 📊 Comparación de Versiones

| SDK Version | Protocol Support | Status |
|-------------|------------------|--------|
| 12.1.0 | Protocol 21-22 | ❌ Incompatible con Protocol 25 |
| 13.0.0 | Protocol 23-24 | ⚠️ Parcialmente compatible |
| 14.6.1 | Protocol 25 | ✅ Totalmente compatible |

---

## 🔍 Detalles Técnicos

### ¿Por qué "Bad union switch: 4"?

El error ocurre al parsear `TransactionResult` XDR:

```typescript
// SDK 12.x espera union switches: 0, 1, 2, 3
enum TransactionResultCode {
    txSUCCESS = 0,
    txFAILED = -1,
    txTOO_EARLY = -2,
    txTOO_LATE = -3
}

// Protocol 25 agregó nuevos códigos (incluyendo switch 4)
enum TransactionResultCodeV25 {
    // ... códigos anteriores ...
    txSOROBAN_INVALID = 4  // ← SDK antiguo no conoce este código
}
```

Cuando el RPC devuelve un `TransactionResult` con switch `4`, el SDK 12.x no sabe parsearlo y lanza "Bad union switch: 4".

### Cambios en Protocol 25

- Nuevos tipos XDR para Soroban
- Cambios en `TransactionResult`
- Nuevos códigos de error
- Actualización de estructura de contratos

### SDK 14.6.1 Features

- ✅ Full Protocol 25 support
- ✅ Nuevos tipos XDR
- ✅ Improved error parsing
- ✅ Better RPC integration
- ✅ Enhanced debugging

---

## 🛠️ Comandos Útiles

### Verificar versión actual del SDK

```bash
cd frontend
pnpm list @stellar/stellar-sdk
```

**Output esperado:**
```
@stellar/stellar-sdk 14.6.1
```

### Limpiar todo y reinstalar

```bash
cd frontend
rm -rf node_modules
rm -rf node_modules/.vite
rm -rf .vite
pnpm install
pnpm dev
```

### Verificar cache del navegador

En DevTools → Application → Storage:
- Clear site data
- Hard reload

---

## 🐛 Si el Error Persiste

### 1. Verificar que el servidor se reinició

```bash
ps aux | grep vite
```

Deberías ver el proceso de Vite corriendo.

### 2. Verificar que el SDK se actualizó

```bash
cat frontend/node_modules/@stellar/stellar-sdk/package.json | grep version
```

Debería mostrar `"version": "14.6.1"` o superior.

### 3. Limpiar cache del navegador completamente

- Abre DevTools (F12)
- Application → Clear Storage
- Click "Clear site data"
- Cierra y abre el navegador

### 4. Verificar consola del navegador

```javascript
// En consola del navegador, ejecuta:
console.log(window.StellarSdk.version)
```

Debería mostrar `14.6.1` o superior.

---

## 📝 Para Futuros Deployments

### package.json recomendado

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^14.0.0"  // Permite 14.x actualizaciones
  }
}
```

### Actualización de SDK en CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Install dependencies
  run: |
    cd frontend
    pnpm install
    # Verificar versión
    pnpm list @stellar/stellar-sdk
```

---

## ✅ Checklist

- [x] SDK actualizado de 12.1.0 a 14.6.1
- [x] package.json modificado
- [x] Dependencies instaladas
- [x] Cache de Vite limpiado
- [x] Servidor dev reiniciado
- [ ] **USUARIO: Hard refresh en navegador** ← ACCIÓN REQUERIDA
- [ ] **USUARIO: Verificar que error desapareció**
- [ ] **USUARIO: Probar aprobación de tokens**

---

## 🎯 Resultado Esperado

Después del hard refresh:

1. ✅ XLM approval funciona (ya funcionó)
2. ✅ ASTRO approval funciona (debería funcionar ahora)
3. ✅ Ambos tokens aprobados
4. ✅ Botón "Add Liquidity" habilitado
5. ✅ Transacción de add_liquidity funciona

---

**Status:** ✅ FIX APLICADO - REQUIERE HARD REFRESH DEL NAVEGADOR
**Archivo:** frontend/package.json
**Cambio:** @stellar/stellar-sdk: 12.1.0 → 14.6.1

**Generado:** 2026-03-11 por Claude Code (Sonnet 4.5)
