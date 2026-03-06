import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a query client for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

interface WrapperProps {
  children: React.ReactNode;
}

// Custom wrapper for components that need providers
function AllTheProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

// Custom render function that wraps components with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render
export { customRender as render };

// Mock tokens for testing
export const mockXLM = {
  symbol: 'XLM',
  name: 'Stellar Lumens',
  address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  decimals: 7,
  price: 0.15,
  logoURI: '/tokens/xlm.svg',
};

export const mockUSDC = {
  symbol: 'USDC',
  name: 'USD Coin',
  address: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  decimals: 7,
  price: 1.0,
  logoURI: '/tokens/usdc.svg',
};

export const mockToken = {
  symbol: 'TEST',
  name: 'Test Token',
  address: 'CYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  decimals: 7,
  price: 10.0,
  logoURI: '/tokens/test.svg',
};
