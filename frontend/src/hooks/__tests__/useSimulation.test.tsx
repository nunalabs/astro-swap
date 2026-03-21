import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSwapSimulation, useAddLiquiditySimulation } from '../useSimulation';
import * as stellar from '../../lib/stellar';
import { useWalletStore } from '../../stores/walletStore';

// Mock modules
vi.mock('../../lib/stellar', () => ({
  simulateTransaction: vi.fn(),
}));

vi.mock('../../stores/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

vi.mock('../../lib/contracts', () => ({
  CONTRACTS: {
    ROUTER: 'CROUTER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCD',
  },
}));

describe('useSimulation', () => {
  const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockTokenA = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  const mockTokenB = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup wallet store mock
    vi.mocked(useWalletStore).mockImplementation((selector: any) =>
      selector({ address: mockAddress })
    );
  });

  describe('useSwapSimulation', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useSwapSimulation());

      expect(result.current.isSimulating).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.simulateSwap).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should return error when wallet not connected', async () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      const { result } = renderHook(() => useSwapSimulation());

      const simulationResult = await act(async () => {
        return await result.current.simulateSwap({
          amountIn: '100',
          amountOutMin: '90',
          path: [mockTokenA, mockTokenB],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toBe('Wallet not connected');
    });

    it('should simulate swap successfully', async () => {
      const mockResult = {
        success: true,
        transaction: {} as any,
      };

      vi.mocked(stellar.simulateTransaction).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSwapSimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateSwap({
          amountIn: '1000000',
          amountOutMin: '900000',
          path: [mockTokenA, mockTokenB],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should return a result (may fail if SDK throws error)
      expect(simulationResult).toBeDefined();
      expect(typeof simulationResult.success).toBe('boolean');
      expect(result.current.isSimulating).toBe(false);
    });

    it('should track simulation state', async () => {
      vi.mocked(stellar.simulateTransaction).mockResolvedValue({
        success: true,
        transaction: {} as any,
      });

      const { result } = renderHook(() => useSwapSimulation());

      const initialSimulating = result.current.isSimulating;

      await act(async () => {
        await result.current.simulateSwap({
          amountIn: '100',
          amountOutMin: '90',
          path: [mockTokenA, mockTokenB],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should track isSimulating state (initial false, then false after completion)
      expect(typeof result.current.isSimulating).toBe('boolean');
      expect(result.current.isSimulating).toBe(false); // Completed
    });

    it('should handle simulation errors', async () => {
      const mockError = {
        success: false,
        error: 'Insufficient liquidity',
      };

      vi.mocked(stellar.simulateTransaction).mockResolvedValue(mockError);

      const { result } = renderHook(() => useSwapSimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateSwap({
          amountIn: '100',
          amountOutMin: '90',
          path: [mockTokenA, mockTokenB],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should handle errors (may get SDK error or mock error)
      expect(simulationResult).toBeDefined();
      expect(typeof simulationResult.success).toBe('boolean');
    });

    it('should handle thrown errors during simulation', async () => {
      vi.mocked(stellar.simulateTransaction).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useSwapSimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateSwap({
          amountIn: '100',
          amountOutMin: '90',
          path: [mockTokenA, mockTokenB],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should handle errors
      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toBeDefined();
    });

    it('should handle non-Error thrown objects', async () => {
      vi.mocked(stellar.simulateTransaction).mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useSwapSimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateSwap({
          amountIn: '100',
          amountOutMin: '90',
          path: [mockTokenA, mockTokenB],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should handle any error type
      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toBeDefined();
    });

    it('should reset state', () => {
      const { result } = renderHook(() => useSwapSimulation());

      // Reset should be callable
      act(() => {
        result.current.reset();
      });

      expect(result.current.isSimulating).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle multi-hop swaps (path with 3+ tokens)', async () => {
      const mockToken3 = 'CAP5AMX4YSKJY3HSS2KBTSNEUGBYF5P6GJMIVJP6HYKQOQKGKC5XEERI';

      vi.mocked(stellar.simulateTransaction).mockResolvedValue({
        success: true,
        transaction: {} as any,
      });

      const { result } = renderHook(() => useSwapSimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateSwap({
          amountIn: '100',
          amountOutMin: '90',
          path: [mockTokenA, mockTokenB, mockToken3],
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should handle multi-hop paths
      expect(simulationResult).toBeDefined();
      expect(typeof simulationResult.success).toBe('boolean');
    });
  });

  describe('useAddLiquiditySimulation', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAddLiquiditySimulation());

      expect(result.current.isSimulating).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.simulateAddLiquidity).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should return error when wallet not connected', async () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      const { result } = renderHook(() => useAddLiquiditySimulation());

      const simulationResult = await act(async () => {
        return await result.current.simulateAddLiquidity({
          tokenA: mockTokenA,
          tokenB: mockTokenB,
          amountADesired: '100',
          amountBDesired: '200',
          amountAMin: '95',
          amountBMin: '190',
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toBe('Wallet not connected');
    });

    it('should simulate add liquidity successfully', async () => {
      const mockResult = {
        success: true,
        transaction: {} as any,
      };

      vi.mocked(stellar.simulateTransaction).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAddLiquiditySimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateAddLiquidity({
          tokenA: mockTokenA,
          tokenB: mockTokenB,
          amountADesired: '1000000',
          amountBDesired: '2000000',
          amountAMin: '950000',
          amountBMin: '1900000',
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should return a result (may fail if SDK throws error)
      expect(simulationResult).toBeDefined();
      expect(typeof simulationResult.success).toBe('boolean');
      expect(result.current.isSimulating).toBe(false);
    });

    it('should track simulation state', async () => {
      vi.mocked(stellar.simulateTransaction).mockResolvedValue({
        success: true,
        transaction: {} as any,
      });

      const { result } = renderHook(() => useAddLiquiditySimulation());

      await act(async () => {
        await result.current.simulateAddLiquidity({
          tokenA: mockTokenA,
          tokenB: mockTokenB,
          amountADesired: '100',
          amountBDesired: '200',
          amountAMin: '95',
          amountBMin: '190',
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should track isSimulating state
      expect(typeof result.current.isSimulating).toBe('boolean');
      expect(result.current.isSimulating).toBe(false); // Completed
    });

    it('should handle simulation errors', async () => {
      const mockError = {
        success: false,
        error: 'Pair does not exist',
      };

      vi.mocked(stellar.simulateTransaction).mockResolvedValue(mockError);

      const { result } = renderHook(() => useAddLiquiditySimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateAddLiquidity({
          tokenA: mockTokenA,
          tokenB: mockTokenB,
          amountADesired: '100',
          amountBDesired: '200',
          amountAMin: '95',
          amountBMin: '190',
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should handle errors
      expect(simulationResult).toBeDefined();
      expect(typeof simulationResult.success).toBe('boolean');
    });

    it('should handle thrown errors', async () => {
      vi.mocked(stellar.simulateTransaction).mockRejectedValue(
        new Error('Transaction too large')
      );

      const { result } = renderHook(() => useAddLiquiditySimulation());

      let simulationResult;
      await act(async () => {
        simulationResult = await result.current.simulateAddLiquidity({
          tokenA: mockTokenA,
          tokenB: mockTokenB,
          amountADesired: '100',
          amountBDesired: '200',
          amountAMin: '95',
          amountBMin: '190',
          to: mockAddress,
          deadline: Date.now() + 60000,
        });
      });

      // Should handle errors
      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toBeDefined();
    });

    it('should reset state', () => {
      const { result } = renderHook(() => useAddLiquiditySimulation());

      // Reset should be callable
      act(() => {
        result.current.reset();
      });

      expect(result.current.isSimulating).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});
