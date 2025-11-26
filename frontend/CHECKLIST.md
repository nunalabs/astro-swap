# AstroSwap Frontend - Deployment Checklist

## Pre-Deployment Setup

### 1. Dependencies
- [ ] Run `npm install` to install all dependencies
- [ ] Verify Node.js version 18+ is installed
- [ ] Install Freighter wallet extension in browser

### 2. Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Set `VITE_STELLAR_NETWORK` (testnet or mainnet)
- [ ] Add `VITE_FACTORY_CONTRACT_ID` (your deployed factory contract)
- [ ] Add `VITE_ROUTER_CONTRACT_ID` (your deployed router contract)
- [ ] Add `VITE_STAKING_CONTRACT_ID` (your deployed staking contract)

### 3. Token Configuration
- [ ] Update token list in `src/stores/tokenStore.ts`
- [ ] Add deployed token contract addresses
- [ ] Add token logos to `public/images/tokens/`
- [ ] Configure default tokens for your network

### 4. Contract Integration
- [ ] Verify contract addresses are correct
- [ ] Test contract calls on testnet first
- [ ] Ensure contracts are deployed and initialized

## Development Testing

### 5. Local Development
- [ ] Run `npm run dev` - starts on http://localhost:3000
- [ ] Test wallet connection with Freighter
- [ ] Verify network matches (testnet/mainnet)
- [ ] Test all major features:
  - [ ] Swap tokens
  - [ ] Add liquidity
  - [ ] Remove liquidity
  - [ ] Stake LP tokens
  - [ ] Unstake
  - [ ] Claim rewards
  - [ ] Dashboard displays correctly

### 6. Type Checking & Linting
- [ ] Run `npm run typecheck` - no TypeScript errors
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Review console for warnings

### 7. Build Verification
- [ ] Run `npm run build` successfully
- [ ] Check bundle size (should be < 1MB total)
- [ ] Run `npm run preview` to test production build
- [ ] Test all features in production mode

## Production Deployment

### 8. Choose Hosting Platform
- [ ] **Vercel** (recommended - zero config)
  ```bash
  npm install -g vercel
  vercel
  ```
- [ ] **Netlify** (drag & drop dist folder)
- [ ] **AWS S3 + CloudFront** (custom domain)
- [ ] **IPFS** (decentralized hosting)

### 9. Configure Production Environment
- [ ] Set environment variables in hosting platform
- [ ] Use mainnet contract addresses
- [ ] Set `VITE_STELLAR_NETWORK=mainnet`
- [ ] Enable SSL/HTTPS

### 10. Deploy
- [ ] Build: `npm run build`
- [ ] Upload `dist/` folder to hosting
- [ ] Configure custom domain (optional)
- [ ] Test deployed site thoroughly

## Post-Deployment

### 11. Verification
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Verify wallet connection works
- [ ] Execute test swap with small amount
- [ ] Check all navigation links
- [ ] Verify responsive design

### 12. Monitoring
- [ ] Set up error tracking (Sentry, Bugsnag)
- [ ] Configure analytics (Google Analytics)
- [ ] Monitor bundle size
- [ ] Check performance metrics

### 13. Security
- [ ] No private keys in code
- [ ] All env vars properly set
- [ ] HTTPS enabled
- [ ] Contract addresses verified
- [ ] No console.log in production

## Maintenance

### 14. Regular Updates
- [ ] Monitor dependency vulnerabilities: `npm audit`
- [ ] Update dependencies monthly: `npm update`
- [ ] Review and update token list
- [ ] Monitor user feedback

### 15. Backup & Version Control
- [ ] Code pushed to Git repository
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Maintain staging environment

## Quick Reference

### Development Commands
```bash
npm install           # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run typecheck    # Check TypeScript
npm run lint         # Lint code
```

### Environment Variables Template
```env
VITE_STELLAR_NETWORK=testnet
VITE_FACTORY_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_ROUTER_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_STAKING_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Important Files
- `src/stores/tokenStore.ts` - Configure tokens
- `src/lib/contracts.ts` - Contract addresses
- `.env` - Environment configuration
- `README.md` - Full documentation
- `SETUP.md` - Setup instructions

### Support Resources
- README.md - Complete documentation
- SETUP.md - Detailed setup guide
- PROJECT_SUMMARY.md - Technical overview
- GitHub Issues - Report bugs
- Discord - Community support

---

**Status Check**: Complete all checkboxes before production deployment
**Last Updated**: 2025-11-25
**Version**: 1.0.0
