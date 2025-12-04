#!/bin/bash
# ==============================================================================
# AstroSwap DEX - Vercel Deployment Script
#
# This script deploys the frontend to Vercel with all environment variables
# configured from the deployed contracts.
#
# Usage:
#   ./scripts/deploy-vercel.sh [production|preview]
#
# Requirements:
#   - Vercel CLI installed (npm i -g vercel)
#   - VERCEL_TOKEN environment variable set
#   - Contracts deployed (.deployed directory populated)
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI not found. Install with: npm i -g vercel"
        exit 1
    fi

    if [ -z "$VERCEL_TOKEN" ]; then
        log_error "VERCEL_TOKEN environment variable not set"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Load deployed contract IDs
load_contract_ids() {
    log_info "Loading deployed contract IDs..."

    DEPLOYED_DIR=".deployed"
    DEPLOYMENT_FILE="$DEPLOYED_DIR/deployment.testnet.json"

    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        log_error "Deployment file not found: $DEPLOYMENT_FILE"
        log_warn "Please deploy contracts first with: make deploy-testnet"
        exit 1
    fi

    # Parse JSON and extract contract IDs
    FACTORY_ID=$(cat "$DEPLOYMENT_FILE" | grep -o '"factory": "[^"]*"' | cut -d'"' -f4)
    ROUTER_ID=$(cat "$DEPLOYMENT_FILE" | grep -o '"router": "[^"]*"' | cut -d'"' -f4)
    STAKING_ID=$(cat "$DEPLOYMENT_FILE" | grep -o '"staking": "[^"]*"' | cut -d'"' -f4)
    AGGREGATOR_ID=$(cat "$DEPLOYMENT_FILE" | grep -o '"aggregator": "[^"]*"' | cut -d'"' -f4)
    BRIDGE_ID=$(cat "$DEPLOYMENT_FILE" | grep -o '"bridge": "[^"]*"' | cut -d'"' -f4)

    log_success "Contract IDs loaded:"
    echo "  Factory:    $FACTORY_ID"
    echo "  Router:     $ROUTER_ID"
    echo "  Staking:    $STAKING_ID"
    echo "  Aggregator: $AGGREGATOR_ID"
    echo "  Bridge:     $BRIDGE_ID"
}

# Set environment variables in Vercel
set_vercel_env() {
    local name=$1
    local value=$2
    local environment=${3:-"production preview development"}

    # Remove existing if present
    vercel env rm "$name" --yes --token "$VERCEL_TOKEN" 2>/dev/null || true

    # Add new value
    echo "$value" | vercel env add "$name" $environment --token "$VERCEL_TOKEN"
}

# Configure Vercel environment
configure_vercel_env() {
    log_info "Configuring Vercel environment variables..."

    # Network configuration
    set_vercel_env "VITE_STELLAR_NETWORK" "testnet"
    set_vercel_env "VITE_SOROBAN_RPC_URL" "https://soroban-testnet.stellar.org"
    set_vercel_env "VITE_NETWORK_PASSPHRASE" "Test SDF Network ; September 2015"

    # Contract IDs
    set_vercel_env "VITE_FACTORY_CONTRACT_ID" "$FACTORY_ID"
    set_vercel_env "VITE_ROUTER_CONTRACT_ID" "$ROUTER_ID"
    set_vercel_env "VITE_STAKING_CONTRACT_ID" "$STAKING_ID"
    set_vercel_env "VITE_AGGREGATOR_CONTRACT_ID" "$AGGREGATOR_ID"
    set_vercel_env "VITE_BRIDGE_CONTRACT_ID" "$BRIDGE_ID"

    # API URL (update this when indexer is deployed)
    if [ -n "$INDEXER_API_URL" ]; then
        set_vercel_env "VITE_INDEXER_API_URL" "$INDEXER_API_URL"
    else
        log_warn "INDEXER_API_URL not set, using placeholder"
        set_vercel_env "VITE_INDEXER_API_URL" "https://api.astroswap.io"
    fi

    log_success "Environment variables configured"
}

# Build and deploy
deploy() {
    local env=${1:-"preview"}

    log_info "Building frontend..."
    cd frontend
    pnpm install
    pnpm typecheck
    pnpm build
    cd ..

    log_info "Deploying to Vercel ($env)..."

    if [ "$env" == "production" ]; then
        vercel --prod --token "$VERCEL_TOKEN" --yes
    else
        vercel --token "$VERCEL_TOKEN" --yes
    fi

    log_success "Deployment complete!"
}

# Main
main() {
    local deploy_env=${1:-"preview"}

    echo ""
    echo "=========================================="
    echo "  AstroSwap DEX - Vercel Deployment"
    echo "=========================================="
    echo ""

    check_prerequisites
    load_contract_ids
    configure_vercel_env
    deploy "$deploy_env"

    echo ""
    log_success "AstroSwap DEX deployed successfully!"
    echo ""
}

# Run
main "$@"
