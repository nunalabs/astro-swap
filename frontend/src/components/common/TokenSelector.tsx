import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from './Modal';
import { AddTokenModal } from './AddTokenModal';
import { useTokenStore } from '../../stores/tokenStore';
import { useWalletStore } from '../../stores/walletStore';
import type { Token } from '../../types';
import { cn } from '../../lib/utils';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  excludeTokens?: string[];
}

export function TokenSelector({ selectedToken, onSelect, excludeTokens = [] }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tokens = useTokenStore((state) => state.tokens);
  const favoriteTokens = useTokenStore((state) => state.favoriteTokens);
  const toggleFavorite = useTokenStore((state) => state.toggleFavorite);
  const isIndexing = useTokenStore((state) => state.isIndexing);
  const indexedTokens = useTokenStore((state) => state.indexedTokens);
  const indexTokensFromChain = useTokenStore((state) => state.indexTokensFromChain);
  const walletAddress = useWalletStore((state) => state.address);

  const filteredTokens = tokens.filter((token) => {
    if (excludeTokens.includes(token.address)) return false;

    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  });

  const favoriteList = filteredTokens.filter((token) =>
    favoriteTokens.includes(token.address)
  );

  const regularList = filteredTokens.filter(
    (token) => !favoriteTokens.includes(token.address)
  );

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
      >
        {selectedToken ? (
          <>
            {selectedToken.logoURI && (
              <img
                src={selectedToken.logoURI}
                alt={selectedToken.symbol}
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="font-semibold">{selectedToken.symbol}</span>
          </>
        ) : (
          <span className="text-neutral-400">Select token</span>
        )}
        <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Select a Token" size="md">
        <div className="space-y-4">
          {/* Search and Refresh */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, symbol, or address"
              className="input flex-1"
              autoFocus
            />
            <button
              onClick={() => walletAddress && indexTokensFromChain(walletAddress)}
              disabled={isIndexing || !walletAddress}
              className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors disabled:opacity-50"
              title="Refresh token list from blockchain"
            >
              <svg
                className={cn('w-5 h-5', isIndexing && 'animate-spin')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Indexing Status */}
          {isIndexing && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Discovering tokens from pools...</span>
            </div>
          )}

          {/* Token count */}
          <div className="text-xs text-neutral-500">
            {tokens.length} tokens available {indexedTokens.length > 0 && `(${indexedTokens.length} from pools)`}
          </div>

          {/* Token List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {/* Favorites */}
            {favoriteList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-400 mb-2">Favorites</h3>
                <div className="space-y-1">
                  {favoriteList.map((token) => (
                    <TokenItem
                      key={token.address}
                      token={token}
                      isFavorite={true}
                      onSelect={handleSelect}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Tokens */}
            {regularList.length > 0 && (
              <div>
                {favoriteList.length > 0 && (
                  <h3 className="text-sm font-semibold text-neutral-400 mb-2 mt-4">All Tokens</h3>
                )}
                <div className="space-y-1">
                  {regularList.map((token) => (
                    <TokenItem
                      key={token.address}
                      token={token}
                      isFavorite={false}
                      onSelect={handleSelect}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredTokens.length === 0 && (
              <div className="text-center py-8 text-neutral-400">
                No tokens found
              </div>
            )}

            {/* Import Token Button */}
            <button
              onClick={() => {
                setIsOpen(false);
                setShowAddToken(true);
              }}
              className="w-full mt-4 p-3 border border-dashed border-neutral-600 rounded-xl text-neutral-400 hover:text-white hover:border-primary transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Import Token
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={showAddToken}
        onClose={() => setShowAddToken(false)}
      />
    </>
  );
}

interface TokenItemProps {
  token: Token;
  isFavorite: boolean;
  onSelect: (token: Token) => void;
  onToggleFavorite: (address: string) => void;
}

function TokenItem({ token, isFavorite, onSelect, onToggleFavorite }: TokenItemProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors',
        'hover:bg-neutral-800'
      )}
    >
      <div className="flex items-center gap-3 flex-1" onClick={() => onSelect(token)}>
        {token.logoURI ? (
          <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
            <span className="text-xs font-semibold">{token.symbol.slice(0, 2)}</span>
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{token.symbol}</span>
          </div>
          <span className="text-sm text-neutral-400">{token.name}</span>
        </div>

        {token.balance && (
          <div className="text-right">
            <div className="font-mono text-sm">{token.balance}</div>
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(token.address);
        }}
        className="ml-2 p-1 hover:bg-neutral-700 rounded-lg transition-colors"
      >
        <svg
          className={cn('w-5 h-5', isFavorite ? 'text-primary fill-current' : 'text-neutral-500')}
          fill={isFavorite ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>
    </motion.div>
  );
}
