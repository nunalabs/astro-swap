import { motion } from 'framer-motion';
import { BridgeCard } from '../components/bridge/BridgeCard';

export function Bridge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 gradient-text">Cross-Chain Bridge</h1>
        <p className="text-neutral-400">Transfer assets seamlessly across blockchains</p>
      </div>

      <BridgeCard />

      {/* Supported Chains */}
      <div className="mt-12 card p-8">
        <h2 className="text-2xl font-bold mb-6">Supported Networks</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-neutral-800 rounded-xl text-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl mx-auto mb-3" />
            <h3 className="font-semibold">Stellar</h3>
          </div>
          <div className="p-4 bg-neutral-800 rounded-xl text-center opacity-50">
            <div className="w-12 h-12 bg-neutral-700 rounded-xl mx-auto mb-3" />
            <h3 className="font-semibold">Ethereum</h3>
            <p className="text-xs text-neutral-400">Coming Soon</p>
          </div>
          <div className="p-4 bg-neutral-800 rounded-xl text-center opacity-50">
            <div className="w-12 h-12 bg-neutral-700 rounded-xl mx-auto mb-3" />
            <h3 className="font-semibold">BSC</h3>
            <p className="text-xs text-neutral-400">Coming Soon</p>
          </div>
          <div className="p-4 bg-neutral-800 rounded-xl text-center opacity-50">
            <div className="w-12 h-12 bg-neutral-700 rounded-xl mx-auto mb-3" />
            <h3 className="font-semibold">Polygon</h3>
            <p className="text-xs text-neutral-400">Coming Soon</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
