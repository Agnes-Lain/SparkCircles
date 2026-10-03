import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { ICON_STROKE_WIDTH } from '../theme/a11y';
import { colorValue } from '../theme/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 20; // length of the check path below, in viewBox units

/**
 * Success checkmark for serious moments (design system section 13: email confirmed,
 * verification sent, verified): a green-dark check draws itself in 300 ms inside a
 * green-light circle. Static under reduced motion. Decorative: the toast says what happened.
 */
export function SuccessCheckmark({ size = 64 }: { size?: number }) {
  const reduceMotion = useReduceMotion();
  // Hidden until the system says whether motion is allowed, so it never jumps from drawn to
  // redrawn.
  const [offset] = useState(() => new Animated.Value(CHECK_LENGTH));

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      offset.setValue(0);
      return;
    }
    Animated.timing(offset, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  }, [reduceMotion, offset]);

  return (
    <View
      testID="success-checkmark"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center rounded-full bg-green-light"
      style={{ width: size, height: size }}
    >
      <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <AnimatedPath
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke={colorValue('green-dark')}
          strokeWidth={ICON_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          strokeDashoffset={offset}
        />
      </Svg>
    </View>
  );
}
