import { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TokenSelector } from '../common/TokenSelector';
import type { Token } from '../../types';

const CHAINS = ['Stellar', 'Ethereum', 'BSC', 'Polygon'];

export function BridgeCard() {
  const [fromChain, setFromChain] = useState('Stellar');
  const [toChain, setToChain] = useState('Ethereum');
  const [token, setToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState('');

  const handleSwapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  return (
    <Card className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Bridge Assets</h2>

      <div className="space-y-4">
        {/* From Chain */}
        <div>
          <label className="text-sm text-neutral-400 mb-2 block">From</label>
          <select
            value={fromChain}
            onChange={(e) => setFromChain(e.target.value)}
            className="input"
          >
            {CHAINS.map((chain) => (
              <option key={chain} value={chain} disabled={chain === toChain}>
                {chain}
              </option>
            ))}
          </select>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapChains}
            className="p-2 bg-card border border-neutral-700 rounded-xl hover:border-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Chain */}
        <div>
          <label className="text-sm text-neutral-400 mb-2 block">To</label>
          <select
            value={toChain}
            onChange={(e) => setToChain(e.target.value)}
            className="input"
          >
            {CHAINS.map((chain) => (
              <option key={chain} value={chain} disabled={chain === fromChain}>
                {chain}
              </option>
            ))}
          </select>
        </div>

        {/* Token and Amount */}
        <div>
          <label className="text-sm text-neutral-400 mb-2 block">Asset</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="input flex-1"
            />
            <TokenSelector selectedToken={token} onSelect={setToken} />
          </div>
        </div>

        {/* Bridge Fee Info */}
        <div className="p-4 bg-neutral-800/50 rounded-xl space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-400">Bridge Fee</span>
            <span className="font-medium">0.1%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Estimated Time</span>
            <span className="font-medium">~5 minutes</span>
          </div>
        </div>

        <Button fullWidth disabled={!token || !amount}>
          Bridge
        </Button>

        <p className="text-xs text-neutral-400 text-center">
          Cross-chain bridges are in development. Coming soon!
        </p>
      </div>
    </Card>
  );
}
