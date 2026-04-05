// Polyfills for Stellar SDK 14.x compatibility
import { Buffer } from 'buffer';

// Type augmentation for proper type safety
declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: Window & typeof globalThis;
    process: { env: Record<string, string | undefined> };
  }
}

window.Buffer = Buffer;
(window as Window & { global?: Window & typeof globalThis }).global = window;
if (!window.process) {
  (window as Window & { process?: { env: Record<string, string | undefined> } }).process = { env: {} };
}

// Initialize Sentry error tracking (before React)
import { initSentry } from './lib/sentry';
initSentry();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
