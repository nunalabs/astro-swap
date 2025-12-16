# AstroSwap Makefile
# Professional DEX for Stellar Soroban

# Default network
NETWORK ?= testnet

# Soroban CLI
STELLAR_CLI = stellar

# Build directory (matches cargo build --target wasm32-unknown-unknown)
BUILD_DIR = target/wasm32-unknown-unknown/release

# Contract names
CONTRACTS = factory pair router staking aggregator bridge

.PHONY: all build test clean fmt lint deploy help

# Default target
all: build test

# Build all contracts
build:
	@echo "Building all contracts..."
	@for contract in $(CONTRACTS); do \
		if [ -d "contracts/$$contract" ]; then \
			echo "Building $$contract..."; \
			cd contracts/$$contract && cargo build --target wasm32-unknown-unknown --release && cd ../..; \
		fi \
	done
	@echo "Build complete!"

# Build individual contracts
build-factory:
	@echo "Building factory..."
	@cd contracts/factory && cargo build --target wasm32-unknown-unknown --release

build-pair:
	@echo "Building pair..."
	@cd contracts/pair && cargo build --target wasm32-unknown-unknown --release

build-router:
	@echo "Building router..."
	@cd contracts/router && cargo build --target wasm32-unknown-unknown --release

build-staking:
	@echo "Building staking..."
	@cd contracts/staking && cargo build --target wasm32-unknown-unknown --release

build-aggregator:
	@echo "Building aggregator..."
	@cd contracts/aggregator && cargo build --target wasm32-unknown-unknown --release

build-bridge:
	@echo "Building bridge..."
	@cd contracts/bridge && cargo build --target wasm32-unknown-unknown --release

# Run tests
test:
	@echo "Running tests..."
	cargo test --workspace
	@echo "Tests complete!"

# Test individual contracts
test-factory:
	@echo "Testing factory..."
	@cd contracts/factory && cargo test

test-pair:
	@echo "Testing pair..."
	@cd contracts/pair && cargo test

test-router:
	@echo "Testing router..."
	@cd contracts/router && cargo test

test-shared:
	@echo "Testing shared library..."
	@cd contracts/shared && cargo test

# Format code
fmt:
	@echo "Formatting code..."
	cargo fmt --all
	@echo "Format complete!"

# Check formatting
fmt-check:
	@echo "Checking formatting..."
	cargo fmt --all -- --check

# Run clippy linter
lint:
	@echo "Running linter..."
	cargo clippy --workspace --all-targets -- -D warnings
	@echo "Lint complete!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	cargo clean
	@echo "Clean complete!"

# Optimize WASM binaries
optimize:
	@echo "Optimizing WASM binaries..."
	@for contract in $(CONTRACTS); do \
		if [ -f "$(BUILD_DIR)/astroswap_$$contract.wasm" ]; then \
			echo "Optimizing $$contract..."; \
			$(STELLAR_CLI) contract optimize \
				--wasm $(BUILD_DIR)/astroswap_$$contract.wasm \
				--wasm-out $(BUILD_DIR)/astroswap_$$contract.optimized.wasm; \
		fi \
	done
	@echo "Optimization complete!"

# Deploy contracts to network
deploy: build optimize
	@echo "Deploying to $(NETWORK)..."
	@./scripts/deploy.sh $(NETWORK)

# Deploy to testnet
deploy-testnet:
	@$(MAKE) deploy NETWORK=testnet

# Deploy to mainnet
deploy-mainnet:
	@$(MAKE) deploy NETWORK=mainnet

# Generate contract bindings
bindings:
	@echo "Generating contract bindings..."
	@for contract in $(CONTRACTS); do \
		if [ -f "$(BUILD_DIR)/astroswap_$$contract.wasm" ]; then \
			echo "Generating bindings for $$contract..."; \
			$(STELLAR_CLI) contract bindings typescript \
				--wasm $(BUILD_DIR)/astroswap_$$contract.wasm \
				--output-dir sdk/src/bindings/$$contract; \
		fi \
	done
	@echo "Bindings generation complete!"

# Install dependencies
install:
	@echo "Installing dependencies..."
	@if ! command -v stellar &> /dev/null; then \
		echo "Installing Stellar CLI..."; \
		cargo install stellar-cli; \
	fi
	@rustup target add wasm32-unknown-unknown
	@echo "Dependencies installed!"

# Setup development environment
setup: install
	@echo "Setting up development environment..."
	@$(STELLAR_CLI) network add testnet \
		--rpc-url https://soroban-testnet.stellar.org:443 \
		--network-passphrase "Test SDF Network ; September 2015" 2>/dev/null || true
	@$(STELLAR_CLI) network add mainnet \
		--rpc-url https://soroban.stellar.org:443 \
		--network-passphrase "Public Global Stellar Network ; September 2015" 2>/dev/null || true
	@echo "Setup complete!"

# Generate documentation
docs:
	@echo "Generating documentation..."
	cargo doc --workspace --no-deps
	@echo "Documentation generated!"

# Run coverage
coverage:
	@echo "Running code coverage..."
	cargo tarpaulin --workspace --out Html
	@echo "Coverage report generated!"

# Verify contract sizes
verify-size:
	@echo "Verifying contract sizes..."
	@for contract in $(CONTRACTS); do \
		if [ -f "$(BUILD_DIR)/astroswap_$$contract.wasm" ]; then \
			SIZE=$$(wc -c < "$(BUILD_DIR)/astroswap_$$contract.wasm"); \
			echo "$$contract: $$SIZE bytes"; \
			if [ $$SIZE -gt 256000 ]; then \
				echo "WARNING: $$contract exceeds 256KB!"; \
			fi \
		fi \
	done

# SDK commands
sdk-install:
	@echo "Installing SDK dependencies..."
	@cd sdk && pnpm install
	@echo "SDK dependencies installed!"

sdk-build:
	@echo "Building SDK..."
	@cd sdk && pnpm build
	@echo "SDK build complete!"

sdk-typecheck:
	@echo "Type checking SDK..."
	@cd sdk && pnpm typecheck
	@echo "SDK type check complete!"

sdk-test:
	@echo "Testing SDK..."
	@cd sdk && pnpm test
	@echo "SDK tests complete!"

sdk-lint:
	@echo "Linting SDK..."
	@cd sdk && pnpm lint
	@echo "SDK lint complete!"

# Help
help:
	@echo "AstroSwap - Makefile Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Contract Targets:"
	@echo "  all          - Build and test all contracts (default)"
	@echo "  build        - Build all contracts"
	@echo "  test         - Run all tests"
	@echo "  clean        - Clean build artifacts"
	@echo "  fmt          - Format code"
	@echo "  lint         - Run clippy linter"
	@echo "  optimize     - Optimize WASM binaries"
	@echo "  deploy       - Deploy contracts (NETWORK=testnet|mainnet)"
	@echo "  bindings     - Generate TypeScript bindings"
	@echo "  install      - Install dependencies"
	@echo "  setup        - Setup development environment"
	@echo "  docs         - Generate documentation"
	@echo "  coverage     - Run code coverage"
	@echo "  verify-size  - Check contract sizes"
	@echo ""
	@echo "SDK Targets:"
	@echo "  sdk-install  - Install SDK dependencies"
	@echo "  sdk-build    - Build SDK"
	@echo "  sdk-typecheck- Type check SDK"
	@echo "  sdk-test     - Run SDK tests"
	@echo "  sdk-lint     - Lint SDK"
	@echo ""
	@echo "Individual builds:"
	@echo "  build-factory, build-pair, build-router, etc."
	@echo ""
	@echo "Individual tests:"
	@echo "  test-factory, test-pair, test-router, test-shared"
	@echo ""
	@echo "  help         - Show this help message"
