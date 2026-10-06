import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { homeFor } from './gate';
import { useGate } from './GateContext';
import { useSession } from './useSession';

/**
 * Email-link screens stay reachable in every gate state, so they leave on their own once
 * their work is done: as soon as the gate knows where this device belongs now (signed in,
 * account state loaded), go there. Waiting for the gate avoids racing the session update.
 * `readyHref` replaces the default landing tab when the account ends up ready.
 */
export function useLeaveWhenGateMoves(done: boolean, readyHref?: Href) {
  const router = useRouter();
  const gate = useGate();
  const { reason } = useSession();

  useEffect(() => {
    if (!done || gate === 'loading') return;
    router.replace(gate === 'ready' && readyHref ? readyHref : homeFor(gate, reason));
  }, [done, gate, reason, router, readyHref]);
}
