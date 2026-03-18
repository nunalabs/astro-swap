# Changelog

All notable changes to AstroSwap DEX Frontend.

## [Unreleased] - 2026-03-19

### Security Fixes

#### High Priority
- **H-1**: Fixed race condition in swap submission using atomic ref locks
- **H-2**: Added quote staleness validation (15s threshold) to prevent stale price TOCTOU
- **H-3**: Protected against BigInt overflow DoS with input length validation (78 char max)
- **H-4**: Replaced floating-point APR calculation with BigInt arithmetic for precision

#### Medium Priority
- **M-3**: Added slippage/deadline validation in settings (0-50%, 1-180min)
- **M-4**: Implemented logoURI validation (HTTPS-only, reject data:/javascript:)
- **M-5**: Added XSS protection for token symbols/names via HTML entity escaping
- **M-6**: Full localStorage recovery on JSON parse errors (clear + reset + save)
- **M-7**: Implemented LRU cache (max 1000 tokens) to prevent memory exhaustion

#### Low Priority
- **W3-1**: Added transaction replay protection with 5-minute window
- **W3-2**: Added reserve data staleness validation (30s threshold)
- **W3-3**: Ensured display/contract slippage calculation consistency (BigInt)

### Refactoring

#### Token Store Architecture
- Split 457-line `tokenStore.ts` into focused modules:
  - `tokenListStore.ts` (230 lines) - Core operations
  - `useTokenDiscovery.ts` (130 lines) - Discovery hook
  - `useTokenSearch.ts` (100 lines) - Search hook
  - `tokenStore.ts` (315 lines) - Legacy compatibility

#### Pool Components
- Extracted `usePoolAmounts.ts` (130 lines) for amount calculations
- Improved separation of concerns in Pool.tsx

### Features

#### Centralized Logger
- Environment-based log levels (debug in dev, info+ in prod)
- Structured logging with context objects
- Production-safe (no sensitive data leaks)
- Performance tracking (time/timeEnd)

### Performance

- LRU cache reduces memory usage for token metadata
- Optimized re-renders with proper memoization
- Bundle size: 1.0MB (main 473KB + vendor 974KB)
- Build time: 735ms with Vite 8.0.0

### Build System

- ✅ Upgraded to Vite 8.0.0 with Rolldown (Rust bundler)
- ✅ Production build successful
- ⚠️ Bundle size warnings (expected for Stellar SDK 974KB)

## Migration Guide

### For Developers

#### Using New Token Stores
```typescript
// Old (still works)
import { useTokenStore } from './stores/tokenStore';

// New (recommended)
import { useTokenListStore } from './stores/tokenListStore';
import { useTokenDiscovery } from './hooks/useTokenDiscovery';
import { useTokenSearch } from './hooks/useTokenSearch';
```

#### Using Centralized Logger
```typescript
// Old
console.log('Swap executed', { amount, token });
console.error('Swap failed', error);

// New
import { logger } from './lib/logger';
logger.info('Swap executed', { amount, token });
logger.error('Swap failed', error, { context });
```

## Security Advisories

See [SECURITY.md](./SECURITY.md) for detailed security fixes and recommendations.

## Contributors

- Claude Sonnet 4.5 (AI Assistant)
- Development Team

---

**Legend**:
- 🔒 Security Fix
- ✨ Feature
- 🐛 Bug Fix
- ♻️ Refactor
- ⚡ Performance
- 📝 Documentation
