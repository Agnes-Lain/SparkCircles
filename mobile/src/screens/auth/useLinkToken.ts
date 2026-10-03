import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useAfterMount } from '../../auth/useAfterMount';

/**
 * The one-time token of an email link (`?token=…`). It is read once, then removed from the
 * route so it doesn't stay in navigation history (M-19). It is only ever sent in a request
 * body, never logged.
 */
export function useLinkToken(): string | null {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const [token] = useState(() => {
    const value = Array.isArray(params.token) ? params.token[0] : params.token;
    return value?.trim() || null;
  });

  const hadToken = params.token !== undefined;
  useAfterMount(() => {
    if (hadToken) router.setParams({ token: undefined });
  });

  return token;
}
