import '../i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../auth/SessionProvider';
import type { TokenStore } from '../auth/tokenStore';
import { ToastProvider } from '../components/ToastProvider';
import { memoryTokenStore } from './fakes';

export const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function createTestQueryClient() {
  return new QueryClient({
    // No background refetch in tests: data a test puts in the cache stays as it is.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

export function TestProviders({
  children,
  queryClient = createTestQueryClient(),
  tokenStore = memoryTokenStore(null),
}: {
  children: ReactNode;
  queryClient?: QueryClient;
  tokenStore?: TokenStore;
}) {
  return (
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider tokenStore={tokenStore}>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** render() with the providers every screen needs (safe area, React Query, session, toasts, i18n). */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => <TestProviders>{children}</TestProviders>,
    ...options,
  });
}
