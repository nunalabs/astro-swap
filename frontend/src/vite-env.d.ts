/// <reference types="vite/client" />

import { Buffer as BufferType } from 'buffer';

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK: string;
  readonly VITE_FACTORY_CONTRACT_ID: string;
  readonly VITE_ROUTER_CONTRACT_ID: string;
  readonly VITE_STAKING_CONTRACT_ID: string;
  readonly VITE_AGGREGATOR_CONTRACT_ID: string;
  readonly VITE_BRIDGE_CONTRACT_ID: string;
  readonly VITE_SOROBAN_RPC_URL: string;
  readonly VITE_NETWORK_PASSPHRASE: string;
  readonly VITE_ENABLE_ANALYTICS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global polyfills for Stellar Wallet Kit
declare global {
  interface Window {
    Buffer: typeof BufferType;
    freighter?: {
      isConnected: () => Promise<{ isConnected: boolean }>;
      getPublicKey: () => Promise<string>;
      getNetwork: () => Promise<string>;
      signTransaction: (
        xdr: string,
        opts: { network: string; networkPassphrase?: string }
      ) => Promise<string>;
      signAuthEntry: (authEntry: string, opts: { network: string }) => Promise<string>;
    };
  }
}

export {};
