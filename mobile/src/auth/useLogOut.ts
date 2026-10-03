import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { auth } from '../api';
import { useToast } from '../components/ToastProvider';
import { useSession } from './useSession';

/**
 * Log out of this device (AC-3.5): `DELETE /sessions/current`, then the token is deleted on
 * the phone even if the request failed (offline): the server-side token then expires after
 * 30 days without use (M-18). Ends on Welcome with the "You're logged out" toast (design A1).
 */
export function useLogOut() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const { showToast } = useToast();

  return useCallback(async () => {
    try {
      await auth().logOut();
    } catch {
      // Offline or already refused: forget the token anyway.
    }
    await signOut();
    showToast(t('common.loggedOut'));
  }, [signOut, showToast, t]);
}
