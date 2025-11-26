import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Swap } from './pages/Swap';
import { Pool } from './pages/Pool';
import { Staking } from './pages/Staking';
import { Bridge } from './pages/Bridge';
import { Dashboard } from './pages/Dashboard';
import { useTokenIndexer } from './hooks/useTokenIndexer';

function App() {
  // Auto-index tokens from factory when wallet connects
  useTokenIndexer();

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/swap" replace />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/pool" element={<Pool />} />
          <Route path="/staking" element={<Staking />} />
          <Route path="/bridge" element={<Bridge />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
