# =============================================================================
# AstroSwap Frontend - Multi-stage Dockerfile
# =============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables
ARG VITE_STELLAR_NETWORK=testnet
ARG VITE_FACTORY_CONTRACT_ID
ARG VITE_ROUTER_CONTRACT_ID
ARG VITE_STAKING_CONTRACT_ID
ARG VITE_INDEXER_API_URL=http://localhost:4001

ENV VITE_STELLAR_NETWORK=$VITE_STELLAR_NETWORK
ENV VITE_FACTORY_CONTRACT_ID=$VITE_FACTORY_CONTRACT_ID
ENV VITE_ROUTER_CONTRACT_ID=$VITE_ROUTER_CONTRACT_ID
ENV VITE_STAKING_CONTRACT_ID=$VITE_STAKING_CONTRACT_ID
ENV VITE_INDEXER_API_URL=$VITE_INDEXER_API_URL

# Build the application
RUN pnpm build

# Stage 3: Runner (nginx for static files)
FROM nginx:alpine AS runner

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
