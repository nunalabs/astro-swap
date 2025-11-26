import { motion } from 'framer-motion';
import { Card } from '../components/common/Card';
import { useWalletStore } from '../stores/walletStore';
import { useTokens } from '../hooks/useTokens';
import { formatCurrency, formatNumber, formatPercent, formatTokenAmount } from '../lib/utils';

export function Dashboard() {
  const { isConnected, balance } = useWalletStore();
  const { tokens } = useTokens();

  const portfolioValue = 1234.56; // Calculate from actual positions
  const change24h = 5.67; // Calculate from actual data

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto"
    >
      <h1 className="text-4xl font-bold mb-8 gradient-text">Dashboard</h1>

      {!isConnected ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-neutral-400">Connect your wallet to view your portfolio</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Portfolio Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <p className="text-sm text-neutral-400 mb-2">Total Portfolio Value</p>
              <p className="text-3xl font-bold mb-1">{formatCurrency(portfolioValue)}</p>
              <p className={`text-sm ${change24h >= 0 ? 'text-green' : 'text-red-500'}`}>
                {formatPercent(change24h, 2)} (24h)
              </p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-neutral-400 mb-2">XLM Balance</p>
              <p className="text-3xl font-bold mb-1">{formatNumber(parseFloat(balance), 2)}</p>
              <p className="text-sm text-neutral-400">Stellar Lumens</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-neutral-400 mb-2">Active Positions</p>
              <p className="text-3xl font-bold mb-1">0</p>
              <p className="text-sm text-neutral-400">Liquidity & Staking</p>
            </Card>
          </div>

          {/* Token Balances */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Token Balances</h2>
            <div className="space-y-3">
              {tokens.filter(t => t.balance && parseFloat(t.balance) > 0).map((token) => (
                <div key={token.address} className="flex items-center justify-between p-3 bg-neutral-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    {token.logoURI && (
                      <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                    )}
                    <div>
                      <p className="font-semibold">{token.symbol}</p>
                      <p className="text-xs text-neutral-400">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">{formatTokenAmount(token.balance || '0', token.decimals, 4)}</p>
                    {token.price && (
                      <p className="text-sm text-neutral-400">
                        {formatCurrency(parseFloat(formatTokenAmount(token.balance || '0', token.decimals)) * token.price)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {tokens.filter(t => t.balance && parseFloat(t.balance) > 0).length === 0 && (
                <p className="text-center text-neutral-400 py-8">No token balances found</p>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            <div className="text-center text-neutral-400 py-8">
              <p>No recent transactions</p>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
