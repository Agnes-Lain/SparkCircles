import { useState } from 'react';

import { colorValue } from '../theme/colors';

/** Spinner colour per module (PM 2026-10-08): the module's Dark, as My space does. */
const TINT = {
  events: 'green-dark',
  circles: 'sky-dark',
  mySpace: 'lavender-dark',
} as const;

/**
 * Props for a RefreshControl: the spinner only follows a pull, never a background refetch
 * (iOS otherwise keeps it spinning until the next scroll), in the module's colour.
 */
export function usePullRefresh(refresh: () => Promise<unknown>, module: keyof typeof TINT) {
  const [refreshing, setRefreshing] = useState(false);
  const tint = colorValue(TINT[module]);
  return {
    refreshing,
    onRefresh: () => {
      setRefreshing(true);
      // A failed refresh is shown by the screen's own error state; just stop spinning.
      void refresh()
        .catch(() => undefined)
        .finally(() => setRefreshing(false));
    },
    tintColor: tint,
    colors: [tint],
  };
}
