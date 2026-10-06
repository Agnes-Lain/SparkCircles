import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { type ReturnTarget, saveReturnTo } from '../../auth/returnTo';

/**
 * The guest's two account actions (US-15): "Créer mon compte" opens Sign up, "J'ai déjà un
 * compte" / "Me connecter" opens Log in. Both first remember where the guest is (the event,
 * the tab, or the Sorties search and its filters), so the account step brings them back
 * there (AC-15.7, AC-15.8).
 */
export function useGuestAccount() {
  const router = useRouter();
  return useMemo(
    () => ({
      signUp: (target: ReturnTarget = {}) => {
        void saveReturnTo(target);
        router.push('/sign-up');
      },
      logIn: (target: ReturnTarget = {}) => {
        void saveReturnTo(target);
        router.push('/log-in');
      },
    }),
    [router],
  );
}
