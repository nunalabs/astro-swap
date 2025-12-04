# AstroSwap DEX - Production Deployment Guide

Complete guide for deploying AstroSwap DEX to production on Stellar Mainnet.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Contract Deployment](#contract-deployment)
4. [Infrastructure Setup](#infrastructure-setup)
5. [Indexer Deployment](#indexer-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Monitoring Setup](#monitoring-setup)
8. [Security Checklist](#security-checklist)
9. [Runbooks](#runbooks)

---

## Prerequisites

### Required Tools

```bash
# Stellar CLI (v22+)
stellar --version

# Rust + WASM target
rustup target add wasm32-unknown-unknown
cargo --version

# Node.js 18+
node --version

# Docker & Docker Compose
docker --version
docker compose version

# pnpm
pnpm --version
```

### Required Accounts

- [ ] Stellar mainnet account with XLM (deployer)
- [ ] Sentry.io account for monitoring
- [ ] Domain configured (e.g., astroswap.io)
- [ ] SSL certificates ready

---

## Pre-Deployment Checklist

### 1. Security Audit

- [ ] Smart contracts audited by professional firm
- [ ] Bug bounty program set up
- [ ] All tests passing (`make test`)
- [ ] No critical/high vulnerabilities in dependencies

### 2. Build Verification

```bash
# Clean build
make clean
make build

# Run full test suite
make test

# Verify WASM sizes (must be < 64KB each)
make verify-size

# Optimize contracts
make optimize
```

### 3. SDK Tests

```bash
cd sdk
pnpm test        # All 202 tests should pass
pnpm typecheck   # No TypeScript errors
```

---

## Contract Deployment

### Step 1: Configure Network

```bash
# Set up mainnet identity
stellar keys generate deployer --network mainnet

# Fund the deployer account (purchase XLM from exchange)
stellar keys address deployer
# Send at least 100 XLM to this address

# Verify balance
stellar account show deployer --network mainnet
```

### Step 2: Deploy Contracts

```bash
# Set environment
export STELLAR_NETWORK=mainnet
export STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm

# Run deployment script
./scripts/deploy.sh mainnet

# This will output contract IDs - SAVE THESE!
```

### Step 3: Verify Deployment

```bash
# Verify each contract
stellar contract info FACTORY_CONTRACT_ID --network mainnet
stellar contract info ROUTER_CONTRACT_ID --network mainnet
stellar contract info STAKING_CONTRACT_ID --network mainnet
```

### Step 4: Initialize Contracts

```bash
# Initialize factory with pair WASM hash
stellar contract invoke \
  --id $FACTORY_CONTRACT_ID \
  --source deployer \
  --network mainnet \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --pair_wasm_hash $PAIR_WASM_HASH \
  --protocol_fee_bps 5

# Initialize router
stellar contract invoke \
  --id $ROUTER_CONTRACT_ID \
  --source deployer \
  --network mainnet \
  -- initialize \
  --factory $FACTORY_CONTRACT_ID \
  --admin $ADMIN_ADDRESS
```

---

## Infrastructure Setup

### Option A: Docker Compose (Single Server)

```bash
# Copy environment file
cp .env.production.example .env.production

# Edit with your values
vim .env.production

# Deploy stack
docker compose -f docker-compose.yml --env-file .env.production up -d

# Verify services
docker compose ps
docker compose logs -f indexer
```

### Option B: Kubernetes (Recommended for Production)

```yaml
# Create namespace
kubectl create namespace astroswap

# Apply secrets
kubectl create secret generic astroswap-secrets \
  --from-env-file=.env.production \
  -n astroswap

# Apply manifests
kubectl apply -f k8s/ -n astroswap
```

### Database Setup

```bash
# Run migrations
docker compose exec indexer npx prisma migrate deploy

# Verify database
docker compose exec postgres psql -U astroswap -c "\dt"
```

---

## Indexer Deployment

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STELLAR_NETWORK` | Yes | `mainnet` or `testnet` |
| `STELLAR_RPC_URL` | Yes | Soroban RPC endpoint |
| `FACTORY_CONTRACT_ID` | Yes | Deployed factory address |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SENTRY_DSN` | No | Sentry error tracking |
| `API_PORT` | No | Default: 3001 |

### Health Checks

```bash
# Liveness probe
curl http://localhost:4001/healthz

# Readiness probe
curl http://localhost:4001/readyz

# Detailed health
curl http://localhost:4001/api/v1/health
```

### Expected Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": { "status": "up", "latency": 5 },
    "redis": { "status": "up", "latency": 2 },
    "stellar": { "status": "up", "latency": 150 }
  }
}
```

---

## Frontend Deployment

### Build for Production

```bash
cd frontend

# Install dependencies
pnpm install

# Build with production environment
VITE_STELLAR_NETWORK=mainnet \
VITE_FACTORY_CONTRACT_ID=$FACTORY_CONTRACT_ID \
VITE_ROUTER_CONTRACT_ID=$ROUTER_CONTRACT_ID \
VITE_INDEXER_API_URL=https://api.astroswap.io \
pnpm build

# Output in dist/
```

### Deploy to CDN (Vercel/Cloudflare)

```bash
# Vercel
vercel --prod

# Cloudflare Pages
npx wrangler pages deploy dist
```

---

## Monitoring Setup

### Sentry Configuration

1. Create Sentry project at https://sentry.io
2. Get DSN from Project Settings > Client Keys
3. Set `SENTRY_DSN` in environment

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| API Response Time | > 2s |
| Error Rate | > 1% |
| Database Connections | > 80% pool |
| Memory Usage | > 85% |
| Disk Usage | > 80% |
| Indexer Lag | > 100 blocks |

### Log Aggregation

```bash
# View logs
docker compose logs -f indexer

# JSON structured logs for production
LOG_LEVEL=info LOG_PRETTY=false
```

---

## Security Checklist

### Infrastructure

- [ ] SSL/TLS certificates configured
- [ ] Firewall rules in place
- [ ] Database not exposed publicly
- [ ] Redis password protected
- [ ] Regular backups configured

### API

- [ ] Rate limiting enabled (100 req/min default)
- [ ] CORS origins restricted
- [ ] Helmet security headers active
- [ ] Input validation on all endpoints
- [ ] Request size limits (1MB)

### Contracts

- [ ] Admin keys stored securely (hardware wallet)
- [ ] Timelock on critical functions
- [ ] Emergency pause mechanism tested
- [ ] Upgrade path documented

---

## Runbooks

### Incident: High Error Rate

```bash
# 1. Check logs
docker compose logs --tail 100 indexer

# 2. Check Sentry for errors
# Open Sentry dashboard

# 3. Check database connections
docker compose exec postgres pg_stat_activity

# 4. Restart if needed
docker compose restart indexer
```

### Incident: Indexer Falling Behind

```bash
# 1. Check current sync status
curl http://localhost:4001/api/v1/health

# 2. Check RPC connectivity
curl https://soroban-rpc.mainnet.stellar.gateway.fm/health

# 3. Increase batch size temporarily
docker compose exec indexer env BATCH_SIZE=500 node dist/index.js
```

### Incident: Database Full

```bash
# 1. Check disk usage
docker compose exec postgres df -h

# 2. Clean old data (if applicable)
docker compose exec postgres psql -U astroswap -c "
  DELETE FROM swaps WHERE timestamp < NOW() - INTERVAL '90 days';
  VACUUM FULL;
"

# 3. Scale up disk if needed
```

### Scheduled: Contract Upgrade

```bash
# 1. Deploy new WASM
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/astroswap_pair.optimized.wasm \
  --source deployer \
  --network mainnet

# 2. Update factory with new hash
stellar contract invoke \
  --id $FACTORY_CONTRACT_ID \
  --source admin \
  --network mainnet \
  -- set_pair_wasm_hash \
  --caller $ADMIN_ADDRESS \
  --wasm_hash $NEW_WASM_HASH
```

---

## Support

- **Documentation**: https://docs.astroswap.io
- **Discord**: https://discord.gg/astroswap
- **GitHub Issues**: https://github.com/astro-shiba/astroswap/issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial production release |
