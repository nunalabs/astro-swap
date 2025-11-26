import { Card } from '../common/Card';
import { Button } from '../common/Button';
import type { Pool } from '../../types';
import { formatNumber, formatCurrency, formatPercent } from '../../lib/utils';

interface PoolCardProps {
  pool: Pool;
  onAddLiquidity?: () => void;
  onRemoveLiquidity?: () => void;
}

export function PoolCard({ pool, onAddLiquidity, onRemoveLiquidity }: PoolCardProps) {
  return (
    <Card hover className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {pool.token0.logoURI && (
              <img src={pool.token0.logoURI} alt={pool.token0.symbol} className="w-8 h-8 rounded-full border-2 border-card" />
            )}
            {pool.token1.logoURI && (
              <img src={pool.token1.logoURI} alt={pool.token1.symbol} className="w-8 h-8 rounded-full border-2 border-card" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">{pool.token0.symbol}/{pool.token1.symbol}</h3>
            <p className="text-xs text-neutral-400">Fee: {pool.fee / 100}%</p>
          </div>
        </div>
        {pool.apr && <div className="badge-success">{formatPercent(pool.apr, 2)} APR</div>}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-neutral-400 mb-1">TVL</p>
          <p className="font-semibold">{pool.tvl ? formatCurrency(pool.tvl) : '-'}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 mb-1">24h Volume</p>
          <p className="font-semibold">{pool.volume24h ? formatCurrency(pool.volume24h) : '-'}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 mb-1">{pool.token0.symbol} Reserve</p>
          <p className="font-mono text-sm">{formatNumber(parseFloat(pool.reserve0), 2)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 mb-1">{pool.token1.symbol} Reserve</p>
          <p className="font-mono text-sm">{formatNumber(parseFloat(pool.reserve1), 2)}</p>
        </div>
      </div>

      {pool.userLiquidity && parseFloat(pool.userLiquidity) > 0 && (
        <div className="mb-4 p-3 bg-gradient-card rounded-lg">
          <p className="text-xs text-neutral-400 mb-1">Your Liquidity</p>
          <p className="font-semibold">{formatNumber(parseFloat(pool.userLiquidity), 4)}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onAddLiquidity} variant="primary" size="sm" fullWidth>
          Add Liquidity
        </Button>
        {pool.userLiquidity && parseFloat(pool.userLiquidity) > 0 && (
          <Button onClick={onRemoveLiquidity} variant="secondary" size="sm" fullWidth>
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}
