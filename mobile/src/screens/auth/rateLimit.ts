import { useEffect } from 'react';

/**
 * How long a resend button stays disabled after a 429 (design addendum D-6: "wait a few
 * minutes"; the exact duration is the developer's, the API still decides).
 */
export const RATE_LIMIT_PAUSE_MS = 3 * 60_000;

/** While `active`, calls `clear` once the pause is over (e.g. a mutation's `reset`). */
export function useClearAfterPause(active: boolean, clear: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(clear, RATE_LIMIT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [active, clear]);
}
