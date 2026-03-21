// Polyfills for Stellar SDK 14.x browser compatibility
import { Buffer } from 'buffer';

// Make Buffer available globally
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = { env: {} };
}

export { Buffer };
