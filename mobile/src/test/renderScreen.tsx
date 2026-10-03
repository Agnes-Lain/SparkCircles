import { renderRouter } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

import type { GateState } from '../auth/gate';
import { GateContext } from '../auth/GateContext';
import { memoryTokenStore } from './fakes';
import { createTestQueryClient, TestProviders } from './render';

/** A stand-in screen that only shows its route name, to assert where a screen navigates. */
export function routeStub(name: string): ComponentType {
  function Stub() {
    return <Text>{`route:${name}`}</Text>;
  }
  return Stub;
}

/**
 * Renders auth screens inside Expo Router with the app's providers (session, toasts, React
 * Query) and a fixed auth gate state. Returns the router result in an object, because
 * awaiting it directly would drop getPathname().
 */
export async function renderScreen(
  routes: Record<string, ComponentType>,
  {
    url,
    token = null,
    gate = 'signedOut',
    queryClient = createTestQueryClient(),
  }: {
    url: string;
    token?: string | null;
    gate?: GateState;
    queryClient?: ReturnType<typeof createTestQueryClient>;
  },
) {
  const tokenStore = memoryTokenStore(token);
  const app = renderRouter(routes, {
    initialUrl: url,
    wrapper: ({ children }) => (
      <TestProviders queryClient={queryClient} tokenStore={tokenStore}>
        <GateContext.Provider value={gate}>{children}</GateContext.Provider>
      </TestProviders>
    ),
  });
  await app;
  return { app, tokenStore, queryClient };
}
