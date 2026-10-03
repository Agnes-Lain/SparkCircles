import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { onUnauthorized } from './sessionEvents';
import { secureTokenStore, type TokenStore } from './tokenStore';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export type Session = {
  status: SessionStatus;
  /** Store the token returned by login, sign-up confirmation or password reset. */
  signIn(token: string): Promise<void>;
  /** Forget the token on this device (the API call to log out is made by the caller). */
  signOut(): Promise<void>;
};

export const SessionContext = createContext<Session | null>(null);

/**
 * Knows whether this device holds a token. The auth gate that sends signed-out users to
 * Welcome is switched on with the login screens (proposal M-9).
 */
export function SessionProvider({
  children,
  tokenStore = secureTokenStore,
}: {
  children: ReactNode;
  tokenStore?: TokenStore;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let active = true;
    tokenStore
      .getToken()
      .then((token) => active && setStatus(token ? 'signedIn' : 'signedOut'))
      .catch(() => active && setStatus('signedOut'));
    return () => {
      active = false;
    };
  }, [tokenStore]);

  // The API client already cleared the token; forget every cached answer too.
  useEffect(
    () =>
      onUnauthorized(() => {
        queryClient.clear();
        setStatus('signedOut');
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (token: string) => {
      await tokenStore.setToken(token);
      setStatus('signedIn');
    },
    [tokenStore],
  );

  const signOut = useCallback(async () => {
    await tokenStore.clearToken();
    queryClient.clear();
    setStatus('signedOut');
  }, [tokenStore, queryClient]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
