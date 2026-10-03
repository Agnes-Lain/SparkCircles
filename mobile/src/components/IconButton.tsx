import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import type { ColorToken } from '../theme/colors';
import { Icon } from './Icon';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only controls always have a label ("Back", "Show password"…). */
  accessibilityLabel: string;
  onPress: () => void;
  color?: ColorToken;
  size?: number;
  testID?: string;
};

/** 44×44 icon-only button (design system P6, section 10 header). */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = 'ink',
  size = 20,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      className="items-center justify-center rounded-md"
      style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
    >
      <Icon icon={icon} color={color} size={size} />
    </Pressable>
  );
}
