import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Polyfill buffer for Stellar SDK 14.x
      buffer: 'buffer',
    },
  },
  define: {
    // Polyfill global for browser compatibility (required by Stellar Wallet Kit)
    global: 'globalThis',
    // Polyfill Buffer for Stellar SDK 14.x
    'process.env': {},
  },
  optimizeDeps: {
    include: ['buffer'],
    // Rolldown handles polyfills automatically
  },
  server: {
    port: parseInt(process.env.VITE_PORT || '3001'),
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('@stellar/stellar-sdk')) {
              return 'stellar-vendor';
            }
            if (id.includes('framer-motion') || id.includes('recharts')) {
              return 'ui-vendor';
            }
          }
        },
      },
    },
  },
});
