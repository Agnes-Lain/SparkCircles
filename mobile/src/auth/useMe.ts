import { useQuery } from '@tanstack/react-query';

import { auth } from '../api';
import { ApiError } from '../api/errors';
import type { Me } from '../api/types';
import { useSession } from './useSession';

export const ME_KEY = ['me'] as const;

/**
 * The signed-in account (`GET /me`), the source of the auth gate. No automatic retry: when
 * the API can't be reached, the gate shows the "couldn't reach" screen with "Try again".
 */
export function useMe() {
  const { status } = useSession();
  return useQuery<Me, ApiError>({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => auth().me(signal),
    enabled: status === 'signedIn',
    retry: false,
    // Screens that read the account (Check your inbox, the error screen) don't ask again on
    // mount after a failure: "Try again" does.
    retryOnMount: false,
  });
}
