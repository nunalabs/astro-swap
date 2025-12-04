import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SkipLinks } from './components/common/SkipLinks';
import { TransactionTracker } from './components/common/TransactionTracker';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useTokenIndexer } from './hooks/useTokenIndexer';

// Lazy load pages for better initial bundle size and performance
const Swap = lazy(() => import('./pages/Swap').then(m => ({ default: m.Swap })));
const Pool = lazy(() => import('./pages/Pool').then(m => ({ default: m.Pool })));
const Staking = lazy(() => import('./pages/Staking').then(m => ({ default: m.Staking })));
const Bridge = lazy(() => import('./pages/Bridge').then(m => ({ default: m.Bridge })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  // Auto-index tokens from factory when wallet connects
  useTokenIndexer();

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Skip Links for keyboard navigation */}
      <SkipLinks />

      <Header />

      <main id="main-content" className="flex-1 container mx-auto px-4 py-8" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/swap" replace />} />
              <Route path="/swap" element={<Swap />} />
              <Route path="/pool" element={<Pool />} />
              <Route path="/staking" element={<Staking />} />
              <Route path="/bridge" element={<Bridge />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />

      {/* Floating transaction tracker */}
      <TransactionTracker />
    </div>
  );
}

export default App;
