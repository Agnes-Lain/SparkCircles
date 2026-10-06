import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { onUnauthorized } from './sessionEvents';
import { secureTokenStore, type TokenStore } from './tokenStore';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

/** Why the device is signed out: the person chose to, or the API refused the token. */
export type SignOutReason = 'logout' | 'unauthorized' | null;

export type Session = {
  status: SessionStatus;
  reason: SignOutReason;
  /**
   * Store the token returned by login, sign-up confirmation or password reset, and forget
   * every cached answer but the account the caller just stored.
   */
  signIn(token: string): Promise<void>;
  /** Forget the token on this device (the API call to log out is made by the caller). */
  signOut(): Promise<void>;
};

export const SessionContext = createContext<Session | null>(null);

/**
 * Knows whether this device holds a token. The auth gate (src/auth/gate.ts, root layout)
 * sends signed-out devices to Welcome, or to Log in after a refused token (M-9, M-18).
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
  const [reason, setReason] = useState<SignOutReason>(null);

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
        setReason('unauthorized');
        setStatus('signedOut');
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (token: string) => {
      await tokenStore.setToken(token);
      // A new token is a new viewer (AC-15.7): nothing cached for the guest (guest event
      // views, guest cards) or another account may show. The account (`['me']`, ME_KEY) is
      // kept: the caller has just stored the one returned with this token.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      setReason(null);
      setStatus('signedIn');
    },
    [tokenStore, queryClient],
  );

  const signOut = useCallback(async () => {
    await tokenStore.clearToken();
    queryClient.clear();
    setReason('logout');
    setStatus('signedOut');
  }, [tokenStore, queryClient]);

  const value = useMemo(
    () => ({ status, reason, signIn, signOut }),
    [status, reason, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
