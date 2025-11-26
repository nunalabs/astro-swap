# AstroSwap Indexer - Quick Start Guide

Get the indexer running in 5 minutes.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or use Docker)
- AstroSwap Factory contract deployed on Stellar

## Option 1: Docker (Recommended)

**Fastest way to get started:**

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set:
# - FACTORY_CONTRACT_ID (required)
# - DB_PASSWORD (optional, defaults to 'changeme')

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps
docker-compose logs -f indexer
```

Services will be available at:
- API: http://localhost:3001
- PostgreSQL: localhost:5432
- Health: http://localhost:3001/health

**Useful commands:**

```bash
# View logs
docker-compose logs -f indexer

# Stop services
docker-compose down

# Stop and remove data
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build
```

## Option 2: Local Development

**For development with hot reload:**

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Setup database
npm run db:generate
npm run db:push

# 4. Start indexer
npm run dev
```

## Verify Installation

```bash
# Check health
curl http://localhost:3001/health

# Get protocol stats
curl http://localhost:3001/api/v1/stats

# List pairs
curl http://localhost:3001/api/v1/pairs
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "database": "connected"
}
```

## Configuration

### Required Environment Variables

```bash
# .env
FACTORY_CONTRACT_ID=CXXX...  # Your deployed factory contract
DATABASE_URL=postgresql://...
```

### Optional Configuration

```bash
# Network (default: testnet)
STELLAR_NETWORK=testnet

# RPC Endpoint (default: Stellar testnet)
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# API Port (default: 3001)
API_PORT=3001

# Polling interval in milliseconds (default: 5000)
POLLING_INTERVAL=5000

# Log level (default: info)
LOG_LEVEL=info
```

## Database Setup

### Using Docker

Database is automatically created and migrated when using `docker-compose up`.

### Manual Setup

```bash
# Create database
createdb astroswap_indexer

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/astroswap_indexer

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### View Database

```bash
# Open Prisma Studio (GUI)
npm run db:studio

# Or use psql
psql $DATABASE_URL
```

## Development

### Project Structure

```
indexer/
├── src/
│   ├── index.ts       # Main entry point
│   ├── listener.ts    # Event listener
│   ├── api.ts         # REST API
│   ├── types.ts       # TypeScript types
│   ├── utils.ts       # Helper functions
│   └── logger.ts      # Logging config
├── prisma/
│   └── schema.prisma  # Database schema
└── package.json
```

### Hot Reload Development

```bash
npm run dev
```

Changes to TypeScript files will automatically reload the service.

### Type Checking

```bash
npm run typecheck
```

### Building for Production

```bash
npm run build
npm start
```

## API Usage Examples

### Get All Pairs

```bash
curl http://localhost:3001/api/v1/pairs
```

### Get Pair Details

```bash
curl http://localhost:3001/api/v1/pairs/CXXX...
```

### Get Recent Swaps

```bash
curl "http://localhost:3001/api/v1/pairs/CXXX.../swaps?limit=10"
```

### Get Price History

```bash
curl "http://localhost:3001/api/v1/pairs/CXXX.../price-history?interval=HOUR_1"
```

### Get User Positions

```bash
curl http://localhost:3001/api/v1/users/GXXX.../positions
```

### Get Protocol Stats

```bash
curl http://localhost:3001/api/v1/stats
```

## Monitoring

### Check Indexer Status

```bash
# View recent logs
docker-compose logs --tail=100 indexer

# Follow logs
docker-compose logs -f indexer

# Check sync progress
docker-compose exec db psql -U astroswap astroswap_indexer -c "SELECT * FROM sync_status;"
```

### Database Queries

```bash
# Connect to database
docker-compose exec db psql -U astroswap astroswap_indexer

# Check pairs
SELECT address, token0, token1, reserve0, reserve1 FROM pairs;

# Check recent swaps
SELECT * FROM swaps ORDER BY timestamp DESC LIMIT 10;

# Check sync status
SELECT * FROM sync_status;
```

### Performance Metrics

```bash
# Container stats
docker stats astroswap-indexer

# Database size
docker-compose exec db psql -U astroswap astroswap_indexer -c "SELECT pg_size_pretty(pg_database_size('astroswap_indexer'));"
```

## Troubleshooting

### Indexer not starting

**Check logs:**
```bash
docker-compose logs indexer
```

**Common issues:**
- Missing `FACTORY_CONTRACT_ID` in .env
- Database not ready (wait 10 seconds and retry)
- Invalid contract address format

### No events appearing

**Check sync status:**
```bash
curl http://localhost:3001/api/v1/stats
```

**Verify:**
- Factory contract ID is correct
- Network matches contract deployment (testnet/mainnet)
- RPC URL is accessible
- Contract has emitted events

### Database connection errors

**Check database is running:**
```bash
docker-compose ps db
```

**Test connection:**
```bash
docker-compose exec db psql -U astroswap -c "SELECT 1;"
```

### RPC errors

**Check RPC endpoint:**
```bash
curl https://soroban-testnet.stellar.org
```

**Solutions:**
- Use a different RPC endpoint
- Increase `RETRY_DELAY` in .env
- Check network connectivity

## Next Steps

1. **Deploy contracts**: Deploy AstroSwap contracts if you haven't
2. **Configure indexer**: Update .env with contract addresses
3. **Start monitoring**: Set up monitoring/alerting
4. **Integrate frontend**: Connect your DApp to the API
5. **Scale**: Add Redis caching, read replicas, etc.

## Production Checklist

- [ ] Use production RPC endpoint (not public testnet)
- [ ] Configure PostgreSQL connection pooling
- [ ] Set up database backups
- [ ] Enable monitoring (Prometheus, Grafana)
- [ ] Configure log aggregation (ELK, Datadog)
- [ ] Set up alerts (PagerDuty, OpsGenie)
- [ ] Use environment-specific .env files
- [ ] Enable rate limiting on API
- [ ] Set up SSL/TLS for API
- [ ] Configure CORS for your domain only
- [ ] Set `LOG_PRETTY=false` for structured JSON logs
- [ ] Set `NODE_ENV=production`

## Resources

- Full documentation: [README.md](./README.md)
- Database schema: [prisma/schema.prisma](./prisma/schema.prisma)
- API types: [src/types.ts](./src/types.ts)

## Support

- GitHub Issues: https://github.com/astroswap/indexer
- Discord: https://discord.gg/astroswap
- Docs: https://docs.astroswap.io

---

**Quick Reference:**

```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f indexer

# Stop
docker-compose down

# Health
curl http://localhost:3001/health

# Stats
curl http://localhost:3001/api/v1/stats
```
