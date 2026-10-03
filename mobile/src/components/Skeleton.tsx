import { useEffect, useState } from 'react';
import { Animated, Easing, type DimensionValue } from 'react-native';

import { useMotionAllowed } from '../hooks/useReduceMotion';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  /** Tailwind radius class, e.g. 'rounded-sm' (default), 'rounded-full'. */
  roundedClassName?: string;
  testID?: string;
};

/**
 * Skeleton block (design system section 13): rgba(0,0,0,0.08) via the `border-soft`
 * token, opacity pulsing 0.5 → 1.0 over 1.5 s, ease-in-out. Static under reduced motion, and
 * static from the first frame until the system says motion is allowed.
 */
export function Skeleton({
  width = '100%',
  height = 12,
  roundedClassName = 'rounded-sm',
  testID,
}: SkeletonProps) {
  const motionAllowed = useMotionAllowed();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!motionAllowed) {
      opacity.setValue(1);
      return;
    }
    const half = { duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, ...half }),
        Animated.timing(opacity, { toValue: 1, ...half }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, motionAllowed]);

  return (
    <Animated.View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className={`bg-border-soft ${roundedClassName}`}
      style={{ width, height, opacity }}
    />
  );
}
