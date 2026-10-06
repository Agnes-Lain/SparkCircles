import type { LucideIcon } from 'lucide-react-native';
import { type Ref, useState } from 'react';
import { Pressable, type View } from 'react-native';

import { useMotionAllowed } from '../hooks/useReduceMotion';
import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { shadows } from '../theme/colors';
import { Icon } from './Icon';

export type HeaderIconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only, so the label is what screen readers announce ("Back", "More options"). */
  accessibilityLabel: string;
  onPress: () => void;
  ref?: Ref<View>;
  testID?: string;
};

/**
 * Screen-header corner button (design back-button.md, option A, v1.8): 44 px white circle,
 * hairline border, light shadow, 24 px Ink icon. Pressed: Shell fill, plus scale 0.97 unless
 * the user reduces motion. Used for back and "⋯"; sheets keep their `x`.
 */
export function HeaderIconButton({
  icon,
  accessibilityLabel,
  onPress,
  ref,
  testID,
}: HeaderIconButtonProps) {
  const [pressed, setPressed] = useState(false);
  const motion = useMotionAllowed();
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={4}
      className={`items-center justify-center rounded-pill border border-border-soft ${
        pressed ? 'bg-shell' : 'bg-surface'
      }`}
      style={{
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        boxShadow: shadows['icon-btn'],
        transform: [{ scale: pressed && motion ? 0.97 : 1 }],
      }}
    >
      <Icon icon={icon} size={24} />
    </Pressable>
  );
}
