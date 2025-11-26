import { motion } from 'framer-motion';
import { SwapCard } from '../components/Swap/SwapCard';
import { ToastContainer } from '../components/common/Toast';

export function Swap() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 gradient-text">Swap Tokens</h1>
        <p className="text-neutral-400">Trade tokens instantly with the best rates on Stellar</p>
      </div>

      <SwapCard />

      <ToastContainer />

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <div className="card p-6">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2">Lightning Fast</h3>
          <p className="text-sm text-neutral-400">
            Execute swaps in seconds with Stellar's high-performance blockchain
          </p>
        </div>

        <div className="card p-6">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2">Secure & Audited</h3>
          <p className="text-sm text-neutral-400">
            Smart contracts audited by leading security firms for your peace of mind
          </p>
        </div>

        <div className="card p-6">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2">Low Fees</h3>
          <p className="text-sm text-neutral-400">
            Trade with minimal fees - only 0.3% per swap, with rewards for liquidity providers
          </p>
        </div>
      </div>
    </motion.div>
  );
}
