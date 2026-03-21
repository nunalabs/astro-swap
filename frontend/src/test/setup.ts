import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Setup localStorage mock before any tests run
class LocalStorageMock {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  get length() {
    return this.store.size;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] || null;
  }
}

global.localStorage = new LocalStorageMock() as Storage;
global.sessionStorage = new LocalStorageMock() as Storage;

// Clear storage before each test
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock wallet-kit module (not needed for unit tests)
vi.mock('../lib/wallet-kit', () => ({
  walletKit: {
    openModal: vi.fn(),
    getAddress: vi.fn(() => Promise.resolve({ address: 'GABC...XYZ' })),
    signTransaction: vi.fn((xdr: string) => Promise.resolve({ signedTxXdr: xdr })),
    setWallet: vi.fn(),
  },
  openWalletModal: vi.fn(() => Promise.resolve({
    address: 'GABC...XYZ',
    walletId: 'freighter',
    walletName: 'Freighter',
  })),
  getWalletAddress: vi.fn(() => Promise.resolve('GABC...XYZ')),
  signTransaction: vi.fn((xdr: string) => Promise.resolve(xdr)),
  signAuthEntry: vi.fn((entry: string) => Promise.resolve(entry)),
  disconnectWallet: vi.fn(),
  isMobileDevice: vi.fn(() => false),
  getMobileWallets: vi.fn(() => []),
  submitWithRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  getTransactionTimeBounds: vi.fn(() => ({
    minTime: Math.floor(Date.now() / 1000),
    maxTime: Math.floor(Date.now() / 1000) + 300,
  })),
  WALLET_IDS: {
    FREIGHTER: 'freighter',
    XBULL: 'xbull',
    LOBSTR: 'lobstr',
    ALBEDO: 'albedo',
  },
  WALLET_METADATA: {},
  NETWORK: 'testnet',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  WalletError: class WalletError extends Error {
    type = 'unknown';
    recoverable = true;
    userMessage = '';
    constructor(type: string, message: string, userMessage: string, recoverable = true) {
      super(message);
      this.type = type;
      this.userMessage = userMessage;
      this.recoverable = recoverable;
    }
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

global.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = MockResizeObserver;

// Suppress console errors during tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {});
