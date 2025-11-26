import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWalletStore } from '../../stores/walletStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { shortenAddress, formatNumber } from '../../lib/utils';
import { Button } from './Button';
import { Modal } from './Modal';

export function ConnectWallet() {
  const {
    isConnected,
    address,
    balance,
    walletName,
    isMobile,
    connect,
    disconnect,
    isConnecting,
  } = useWalletStore();
  const addToast = useSettingsStore((state) => state.addToast);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      addToast({
        type: 'success',
        title: 'Wallet Connected',
        description: `Connected via ${useWalletStore.getState().walletName}`,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User closed wallet modal') {
        return; // User cancelled, no error toast needed
      }
      addToast({
        type: 'error',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowAccountModal(false);
    addToast({
      type: 'info',
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
  };

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    addToast({
      type: 'success',
      title: 'Copied',
      description: 'Address copied to clipboard',
    });
  };

  if (!isConnected) {
    return (
      <Button
        onClick={handleConnect}
        isLoading={isConnecting}
        size={isMobile ? 'sm' : 'md'}
        className="min-w-[140px]"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className={isMobile ? 'hidden sm:inline' : ''}>
          {isConnecting ? 'Connecting...' : 'Connect'}
        </span>
      </Button>
    );
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowAccountModal(true)}
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-card border border-neutral-700 hover:border-primary rounded-xl transition-colors"
      >
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green rounded-full animate-pulse" />
          <span className="font-mono text-sm hidden sm:inline">
            {shortenAddress(address!, isMobile ? 3 : 4)}
          </span>
          <span className="font-mono text-sm sm:hidden">
            {shortenAddress(address!, 3)}
          </span>
        </div>

        {/* Balance - Hidden on very small screens */}
        <div className="hidden xs:flex items-center gap-1 px-2 py-1 bg-neutral-800 rounded-lg">
          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-mono text-sm">{formatNumber(parseFloat(balance), 2)} XLM</span>
        </div>
      </motion.button>

      {/* Account Modal */}
      <Modal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title="Account"
        size="sm"
      >
        <div className="space-y-6">
          {/* Wallet Info */}
          {walletName && (
            <div className="flex items-center justify-center gap-2 p-3 bg-gradient-card rounded-xl">
              <div className="w-2 h-2 bg-green rounded-full" />
              <span className="text-sm text-neutral-300">
                Connected via <span className="text-white font-medium">{walletName}</span>
              </span>
            </div>
          )}

          {/* Address */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Address</label>
            <div className="flex items-center gap-2 p-3 bg-neutral-800 rounded-xl">
              <span className="font-mono text-sm flex-1 truncate">
                {isMobile ? shortenAddress(address!, 6) : shortenAddress(address!, 8)}
              </span>
              <button
                onClick={copyAddress}
                className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                title="Copy address"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Balance</label>
            <div className="p-4 bg-gradient-card rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{formatNumber(parseFloat(balance), 4)}</span>
                <span className="text-neutral-400">XLM</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <a
              href={`https://stellar.expert/explorer/${
                import.meta.env.VITE_STELLAR_NETWORK === 'mainnet' ? 'public' : 'testnet'
              }/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
            >
              <span>View on Stellar Expert</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>

            <Button onClick={handleDisconnect} variant="secondary" fullWidth>
              Disconnect
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
