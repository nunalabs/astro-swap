import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../common/Button';

export function SwapSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { slippageTolerance, deadline, updateSettings } = useSettingsStore();

  const [customSlippage, setCustomSlippage] = useState(slippageTolerance.toString());
  const [customDeadline, setCustomDeadline] = useState(deadline.toString());

  const presetSlippages = [0.1, 0.5, 1.0];

  const handleSave = () => {
    updateSettings({
      slippageTolerance: parseFloat(customSlippage),
      deadline: parseInt(customDeadline),
    });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
        aria-label="Settings"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Settings Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 mt-2 w-80 bg-card border border-neutral-800 rounded-xl shadow-2xl z-50 p-4 space-y-4"
            >
              <h3 className="font-semibold text-lg">Swap Settings</h3>

              {/* Slippage Tolerance */}
              <div className="space-y-2">
                <label htmlFor="slippage-input" className="text-sm text-neutral-400">
                  Slippage Tolerance
                </label>

                <div className="flex gap-2" role="group" aria-label="Preset slippage options">
                  {presetSlippages.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setCustomSlippage(preset.toString())}
                      aria-pressed={parseFloat(customSlippage) === preset}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                        parseFloat(customSlippage) === preset
                          ? 'bg-primary text-white'
                          : 'bg-neutral-800 hover:bg-neutral-700'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    id="slippage-input"
                    type="number"
                    value={customSlippage}
                    onChange={(e) => setCustomSlippage(e.target.value)}
                    className="input pr-8"
                    placeholder="Custom"
                    step="0.1"
                    min="0"
                    max="50"
                    aria-describedby={parseFloat(customSlippage) > 5 ? "slippage-warning" : undefined}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true">
                    %
                  </span>
                </div>

                {parseFloat(customSlippage) > 5 && (
                  <p id="slippage-warning" className="text-xs text-primary" role="alert">
                    High slippage tolerance may result in unfavorable rates
                  </p>
                )}
              </div>

              {/* Transaction Deadline */}
              <div className="space-y-2">
                <label htmlFor="deadline-input" className="text-sm text-neutral-400">
                  Transaction Deadline
                </label>

                <div className="relative">
                  <input
                    id="deadline-input"
                    type="number"
                    value={customDeadline}
                    onChange={(e) => setCustomDeadline(e.target.value)}
                    className="input pr-16"
                    placeholder="20"
                    step="1"
                    min="1"
                    max="180"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true">
                    minutes
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    setCustomSlippage(slippageTolerance.toString());
                    setCustomDeadline(deadline.toString());
                    setIsOpen(false);
                  }}
                  variant="secondary"
                  size="sm"
                  fullWidth
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} size="sm" fullWidth>
                  Save
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
