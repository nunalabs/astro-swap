# AstroSwap Frontend - Setup Guide

## Quick Start

```bash
cd /Users/munay/dev/Astro/astroswap/frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

## Required Configuration

### 1. Environment Variables

Edit `.env` and add your contract addresses:

```env
VITE_STELLAR_NETWORK=testnet
VITE_FACTORY_CONTRACT_ID=YOUR_FACTORY_CONTRACT_HERE
VITE_ROUTER_CONTRACT_ID=YOUR_ROUTER_CONTRACT_HERE
VITE_STAKING_CONTRACT_ID=YOUR_STAKING_CONTRACT_HERE
```

### 2. Freighter Wallet

Install Freighter wallet extension:
- Chrome: https://chrome.google.com/webstore
- Firefox: https://addons.mozilla.org/firefox

### 3. Token Configuration

Update token addresses in `/src/stores/tokenStore.ts`:

```typescript
const DEFAULT_TOKENS: Token[] = [
  {
    address: 'NATIVE',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
  },
  // Add your deployed token addresses here
];
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── TokenSelector.tsx
│   │   │   └── ConnectWallet.tsx
│   │   ├── layout/          # Layout components
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── swap/            # Swap feature
│   │   │   ├── SwapCard.tsx
│   │   │   ├── TokenInput.tsx
│   │   │   └── SwapSettings.tsx
│   │   ├── pool/            # Liquidity pools
│   │   │   └── PoolCard.tsx
│   │   ├── staking/         # Staking pools
│   │   │   └── StakingCard.tsx
│   │   └── bridge/          # Cross-chain bridge
│   │       └── BridgeCard.tsx
│   ├── pages/               # Route pages
│   │   ├── Swap.tsx
│   │   ├── Pool.tsx
│   │   ├── Staking.tsx
│   │   ├── Bridge.tsx
│   │   └── Dashboard.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useSwap.ts
│   │   ├── usePool.ts
│   │   ├── useStaking.ts
│   │   └── useTokens.ts
│   ├── stores/              # Zustand state stores
│   │   ├── walletStore.ts
│   │   ├── tokenStore.ts
│   │   └── settingsStore.ts
│   ├── lib/                 # Utilities
│   │   ├── stellar.ts       # Stellar SDK integration
│   │   ├── contracts.ts     # Smart contract calls
│   │   └── utils.ts         # Helper functions
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── App.tsx              # Main app
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

## Available Scripts

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Build for production
npm run preview    # Preview production build
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
```

## Design System

### Colors
- Primary (Orange): `#fa9427`
- Blue: `#247bca`
- Green: `#144722`
- Background: `#0a0a0a`
- Card: `#141414`

### Components

#### Button
```tsx
<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>
```

Variants: `primary`, `secondary`, `outline`, `ghost`
Sizes: `sm`, `md`, `lg`

#### Card
```tsx
<Card variant="gradient" hover padding="md">
  Content
</Card>
```

#### Modal
```tsx
<Modal isOpen={isOpen} onClose={onClose} title="Title">
  Content
</Modal>
```

### Hooks

#### useSwap
```tsx
const { amountOut, swap, isSwapping } = useSwap(tokenIn, tokenOut);
```

#### usePool
```tsx
const { pools, addLiquidity, removeLiquidity } = usePool();
```

#### useStaking
```tsx
const { stakeInfo, stake, unstake, claimRewards } = useStaking(poolId);
```

## Integration with Contracts

The frontend integrates with your deployed Soroban contracts:

1. **Factory Contract**: Create and list trading pairs
2. **Router Contract**: Execute swaps and manage liquidity
3. **Staking Contract**: Stake LP tokens and earn rewards

Contract calls are handled in `/src/lib/contracts.ts`

## State Management

### Wallet Store (Zustand)
- Connection status
- User address
- Balance
- Connect/disconnect functions

### Token Store (Zustand)
- Available tokens
- Token balances
- Favorite tokens

### Settings Store (Zustand)
- Slippage tolerance
- Transaction deadline
- Toast notifications

## Styling

- **TailwindCSS** for utility classes
- **Framer Motion** for animations
- Custom design system matching Astro-Shiba
- Dark theme with glass morphism effects

## Production Deployment

```bash
# Build
npm run build

# The build output will be in /dist
# Deploy to your preferred hosting:
# - Vercel
# - Netlify
# - AWS S3 + CloudFront
# - IPFS
```

## Troubleshooting

### Wallet Not Connecting
- Ensure Freighter is installed
- Check you're on the correct network (testnet/mainnet)
- Clear browser cache

### Contract Calls Failing
- Verify contract addresses in `.env`
- Check wallet has sufficient XLM balance
- Ensure contracts are deployed correctly

### Build Errors
- Delete `node_modules` and reinstall
- Clear Vite cache: `rm -rf node_modules/.vite`
- Check Node.js version (18+)

## Next Steps

1. Deploy your Soroban contracts
2. Update `.env` with contract addresses
3. Customize token list in `tokenStore.ts`
4. Add your logo/branding in `public/`
5. Deploy frontend to production

## Support

For issues or questions:
- Check the README.md
- Review the code comments
- Open an issue on GitHub
- Join the Discord community
