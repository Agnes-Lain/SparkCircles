import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from './errors';

/** One retry for network trouble, none for answers the server gave on purpose (4xx). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

const ACCOUNT_GATES = ['email_not_confirmed', 'closure_pending', 'terms_acceptance_required'];

/** A 403 account gate (contract §1) mid-session: the account changed, ask again. */
export function isAccountGateError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && ACCOUNT_GATES.includes(error.code);
}

export function createQueryClient(): QueryClient {
  // A gate code on any request refreshes GET /me, so the auth gate shows the right screen
  // (S3, S9 or S10) without waiting for the next app start.
  const onError = (error: unknown) => {
    if (isAccountGateError(error)) void client.invalidateQueries({ queryKey: ['me'] });
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  return client;
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
