#!/bin/bash

# AstroSwap Indexer Setup Script

set -e

echo "🚀 AstroSwap Indexer Setup"
echo "=========================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL client not found. Make sure PostgreSQL is installed and running."
else
    echo "✅ PostgreSQL found: $(psql --version)"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup environment
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
    echo "   Required: DATABASE_URL, FACTORY_CONTRACT_ID"
else
    echo "✅ .env file already exists"
fi

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npm run db:generate

# Prompt for database setup
echo ""
read -p "Do you want to setup the database now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Setting up database..."
    npm run db:push
    echo "✅ Database setup complete"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Run 'npm run db:push' to setup the database"
echo "3. Run 'npm run dev' to start the indexer"
echo ""
echo "For more information, see README.md"
