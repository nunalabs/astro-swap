import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTokenStore } from '../../stores/tokenStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { isValidContractId } from '../../lib/utils';
import { sorobanServer, NETWORK_PASSPHRASE } from '../../lib/stellar';
import * as StellarSdk from '@stellar/stellar-sdk';
import type { Token } from '../../types';

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTokenModal({ isOpen, onClose }: AddTokenModalProps) {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<Partial<Token> | null>(null);
  const [error, setError] = useState('');

  const addCustomToken = useTokenStore((state) => state.addCustomToken);
  const addToast = useSettingsStore((state) => state.addToast);

  const fetchTokenInfo = async () => {
    if (!address || !isValidContractId(address)) {
      setError('Please enter a valid contract ID (starts with C, 56 characters)');
      return;
    }

    setIsLoading(true);
    setError('');
    setTokenInfo(null);

    try {
      // Create a dummy account for simulation
      const dummyAccount = new StellarSdk.Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );

      const contract = new StellarSdk.Contract(address);

      // Fetch symbol
      const symbolTx = new StellarSdk.TransactionBuilder(dummyAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('symbol'))
        .setTimeout(30)
        .build();

      const symbolResult = await sorobanServer.simulateTransaction(symbolTx);

      if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(symbolResult)) {
        throw new Error('Failed to fetch token symbol');
      }

      const symbol = StellarSdk.scValToNative(symbolResult.result!.retval) as string;

      // Fetch name
      const nameTx = new StellarSdk.TransactionBuilder(dummyAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('name'))
        .setTimeout(30)
        .build();

      const nameResult = await sorobanServer.simulateTransaction(nameTx);

      if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(nameResult)) {
        throw new Error('Failed to fetch token name');
      }

      const name = StellarSdk.scValToNative(nameResult.result!.retval) as string;

      // Fetch decimals
      const decimalsTx = new StellarSdk.TransactionBuilder(dummyAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('decimals'))
        .setTimeout(30)
        .build();

      const decimalsResult = await sorobanServer.simulateTransaction(decimalsTx);

      if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(decimalsResult)) {
        throw new Error('Failed to fetch token decimals');
      }

      const decimals = Number(StellarSdk.scValToNative(decimalsResult.result!.retval));

      setTokenInfo({
        address,
        symbol,
        name,
        decimals,
      });
    } catch (err) {
      console.error('Error fetching token info:', err);
      setError('Failed to fetch token info. Make sure the contract is a valid Soroban token.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!tokenInfo) return;

    const token: Token = {
      address: tokenInfo.address!,
      symbol: tokenInfo.symbol!,
      name: tokenInfo.name!,
      decimals: tokenInfo.decimals!,
    };

    const success = await addCustomToken(token);

    if (success) {
      addToast({
        type: 'success',
        title: 'Token Imported',
        description: `${token.symbol} has been added to your token list`,
      });
      handleClose();
    } else {
      addToast({
        type: 'error',
        title: 'Import Failed',
        description: 'Token already exists in your list',
      });
    }
  };

  const handleClose = () => {
    setAddress('');
    setTokenInfo(null);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Token" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-neutral-400 mb-2">
            Token Contract Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value.toUpperCase())}
              placeholder="CXXXX..."
              className="input flex-1 font-mono text-sm"
              maxLength={56}
            />
            <Button
              onClick={fetchTokenInfo}
              isLoading={isLoading}
              disabled={!address || address.length !== 56}
            >
              Fetch
            </Button>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>

        {tokenInfo && (
          <div className="p-4 bg-neutral-800 rounded-xl space-y-3">
            <h3 className="font-semibold text-lg">Token Found</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-neutral-400">Symbol:</span>
                <span className="ml-2 font-medium">{tokenInfo.symbol}</span>
              </div>
              <div>
                <span className="text-neutral-400">Decimals:</span>
                <span className="ml-2 font-medium">{tokenInfo.decimals}</span>
              </div>
              <div className="col-span-2">
                <span className="text-neutral-400">Name:</span>
                <span className="ml-2 font-medium">{tokenInfo.name}</span>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-500 text-sm">
                <strong>Warning:</strong> Anyone can create a token with any name. Make sure you trust this token before importing.
              </p>
            </div>

            <Button onClick={handleImport} fullWidth>
              Import {tokenInfo.symbol}
            </Button>
          </div>
        )}

        <p className="text-xs text-neutral-500">
          Import any Soroban token by entering its contract address. The token will be added to your local list and persisted across sessions.
        </p>
      </div>
    </Modal>
  );
}
