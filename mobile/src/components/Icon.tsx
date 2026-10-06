import type { LucideIcon } from 'lucide-react-native';

import { ICON_STROKE_WIDTH } from '../theme/a11y';
import { type ColorToken, colorValue } from '../theme/colors';

export type IconProps = {
  /** A Lucide icon component, e.g. `House` from lucide-react-native. */
  icon: LucideIcon;
  /** Color token name, as in the Tailwind classes ('ink', 'green-dark'…). */
  color?: ColorToken;
  size?: number;
  /** Stroke 1.8 everywhere, except the few specs that say otherwise (category icons: 2). */
  strokeWidth?: number;
  testID?: string;
};

/**
 * Line icon, Lucide, stroke 1.8 (design system). Decorative: the control that holds it
 * carries the accessible label.
 */
export function Icon({
  icon: LucideComponent,
  color = 'ink',
  size = 20,
  strokeWidth = ICON_STROKE_WIDTH,
  testID,
}: IconProps) {
  return (
    <LucideComponent
      color={colorValue(color)}
      size={size}
      strokeWidth={strokeWidth}
      accessible={false}
      importantForAccessibility="no"
      testID={testID}
    />
  );
}
