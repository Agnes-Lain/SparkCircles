import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the user asked the system to reduce motion (design system P6, section 13).
 * `null` until the system answers (a moment after mount): treat it as "don't animate yet",
 * so nothing moves before we know (QA BUG-05). Then `true` (static skeletons, checkmarks
 * and toasts) or `false`, kept up to date when the setting changes.
 */
export function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => active && setReduceMotion(true)); // unknown: stay still
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

/** True only once the system confirmed animations are allowed. */
export function useMotionAllowed(): boolean {
  return useReduceMotion() === false;
}
