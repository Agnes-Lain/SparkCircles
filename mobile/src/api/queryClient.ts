import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from './errors';

/** One retry for network trouble, none for answers the server gave on purpose (4xx). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}

/** Pause queries while offline and refresh when the app comes back to the foreground. */
export function connectQueryManagers(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) =>
    focusManager.setFocused(status === 'active'),
  );
  return () => subscription.remove();
}
