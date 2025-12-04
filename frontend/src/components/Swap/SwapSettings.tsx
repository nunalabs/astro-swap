import { useSettingsStore } from '../../stores/settingsStore';

// Simple slippage options - just two choices
const SLIPPAGE_OPTIONS = [
  { value: 0.5, label: '0.5%', description: 'Recommended' },
  { value: 1.0, label: '1%', description: 'Volatile pairs' },
] as const;

export function SwapSettings() {
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const handleSlippageChange = (value: number) => {
    updateSettings({ slippageTolerance: value });
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-neutral-500 mr-1">Slippage:</span>
      <div className="flex gap-1" role="group" aria-label="Slippage tolerance">
        {SLIPPAGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSlippageChange(option.value)}
            aria-pressed={slippageTolerance === option.value}
            title={option.description}
            className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
              slippageTolerance === option.value
                ? 'bg-primary text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
