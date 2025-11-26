# AstroSwap Frontend

Professional AMM DEX interface built on Stellar Network.

## Features

- **Swap**: Trade tokens instantly with optimal routing
- **Liquidity Pools**: Provide liquidity and earn trading fees
- **Staking**: Stake LP tokens to earn additional rewards
- **Bridge**: Cross-chain asset transfers (coming soon)
- **Dashboard**: Portfolio tracking and analytics

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **TailwindCSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Zustand** - Lightweight state management
- **React Query** - Data fetching and caching
- **Stellar SDK** - Blockchain integration

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Freighter Wallet browser extension

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install

# Copy environment variables
cp .env.example .env

# Update .env with your contract addresses
```

### Environment Variables

Create a `.env` file with the following variables:

```env
VITE_STELLAR_NETWORK=testnet  # or mainnet
VITE_FACTORY_CONTRACT_ID=your_factory_contract_id
VITE_ROUTER_CONTRACT_ID=your_router_contract_id
VITE_STAKING_CONTRACT_ID=your_staking_contract_id
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run typecheck

# Lint
npm run lint
```

The app will be available at `http://localhost:3000`

## Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── common/       # Reusable components
│   │   ├── layout/       # Layout components
│   │   ├── swap/         # Swap-related components
│   │   ├── pool/         # Pool components
│   │   ├── staking/      # Staking components
│   │   └── bridge/       # Bridge components
│   ├── pages/            # Page components
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores
│   ├── lib/              # Utilities and helpers
│   ├── types/            # TypeScript types
│   └── App.tsx           # Main app component
├── public/               # Static assets
└── package.json
```

## Design System

### Colors

- **Primary**: `#fa9427` (Orange) - CTAs, buttons
- **Blue**: `#247bca` - Trust elements
- **Green**: `#144722` - Success states
- **Background**: `#0a0a0a` - Dark background
- **Card**: `#141414` - Card backgrounds

### Typography

- **Font Family**: Inter (sans-serif), JetBrains Mono (monospace)
- **Font Weights**: 300, 400, 500, 600, 700, 800

### Spacing

- Base unit: 4px
- Border radius: `rounded-xl` (12px)

## Key Features

### Wallet Integration

- Freighter wallet support
- Auto-reconnect on page reload
- Real-time balance updates
- Transaction signing

### Swap Functionality

- Token-to-token swaps
- Optimal routing for best rates
- Slippage protection
- Price impact warnings
- Multi-hop swaps

### Liquidity Management

- Add/remove liquidity
- Pool analytics (TVL, volume, APR)
- LP token tracking
- Fee earnings display

### Staking

- Stake LP tokens
- Earn reward tokens
- Real-time APR calculation
- Claim rewards anytime

## Performance

- Code splitting for optimal bundle size
- React Query for efficient data fetching
- Lazy loading of routes
- Optimized re-renders with Zustand

## Security

- No private keys stored
- All transactions signed via Freighter
- Input validation
- Slippage protection
- Price impact warnings

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License

## Support

For support, join our Discord or open an issue on GitHub.

## Acknowledgments

- Built with Stellar SDK
- Inspired by Uniswap and other leading DEXs
- Part of the Astro ecosystem on Stellar
