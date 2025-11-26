# AstroSwap Indexer Makefile

.PHONY: help install dev build start clean test lint typecheck docker-build docker-up docker-down docker-logs db-generate db-push db-migrate db-studio db-reset

# Default target
help:
	@echo "AstroSwap Indexer - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "Setup:"
	@echo "  make install      - Install dependencies"
	@echo "  make setup        - Run setup script"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server with hot reload"
	@echo "  make build        - Build for production"
	@echo "  make start        - Start production server"
	@echo ""
	@echo "Database:"
	@echo "  make db-generate  - Generate Prisma client"
	@echo "  make db-push      - Push schema to database"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-studio    - Open Prisma Studio"
	@echo "  make db-reset     - Reset database (WARNING: deletes all data)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start all services with Docker Compose"
	@echo "  make docker-down  - Stop all services"
	@echo "  make docker-logs  - View service logs"
	@echo ""
	@echo "Quality:"
	@echo "  make lint         - Run linter"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo "  make clean        - Clean build artifacts"
	@echo ""

# Setup and Installation
install:
	npm install

setup:
	@bash scripts/setup.sh

# Development
dev:
	npm run dev

build:
	npm run build

start:
	npm start

# Database
db-generate:
	npm run db:generate

db-push:
	npm run db:push

db-migrate:
	npm run db:migrate

db-studio:
	npm run db:studio

db-reset:
	@echo "⚠️  This will DELETE all data. Press Ctrl+C to cancel..."
	@sleep 3
	npx prisma migrate reset --force

# Docker
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d
	@echo "✅ Services started"
	@echo "   API: http://localhost:3001"
	@echo "   Health: http://localhost:3001/health"
	@echo ""
	@echo "View logs: make docker-logs"

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f indexer

docker-clean:
	docker-compose down -v
	@echo "⚠️  All data volumes removed"

# Quality
lint:
	npm run lint

typecheck:
	npm run typecheck

# Clean
clean:
	rm -rf dist/
	rm -rf node_modules/
	@echo "✅ Cleaned build artifacts"

# All-in-one commands
dev-setup: install db-generate db-push
	@echo "✅ Development setup complete"
	@echo "Run 'make dev' to start"

docker-setup:
	@if [ ! -f .env ]; then \
		echo "Creating .env file..."; \
		cp .env.example .env; \
		echo "⚠️  Please edit .env with your configuration"; \
		exit 1; \
	fi
	@make docker-build
	@make docker-up
	@echo "✅ Docker setup complete"

# Production deployment
deploy: build
	@echo "🚀 Deploying to production..."
	@echo "Ensure DATABASE_URL and FACTORY_CONTRACT_ID are set"
	npm start
