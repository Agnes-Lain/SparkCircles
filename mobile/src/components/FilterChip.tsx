import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { Icon } from './Icon';

/** Visible chip height (design system v1.6, section 6); the touch area is 44 px. */
export const CHIP_HEIGHT = 32;
const CHIP_HIT_SLOP = (MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2;

export type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional 15 px line icon before the label. */
  icon?: LucideIcon;
  /** Custom leading element instead of `icon` (the category circle, see CategoryPill). */
  leading?: ReactNode;
  testID?: string;
};

/**
 * Filter chip (design system v1.6, section 6): 32 px pill, 1 px Ink 3 border, Surface fill,
 * 13 px/400 Ink label, 15 px icons; selected = mint Base fill + mint Dark border, label 500.
 * The touch area reaches 44 px through a hit slop (keep ≥ 8 px between chips).
 */
export function FilterChip({ label, selected, onPress, icon, leading, testID }: FilterChipProps) {
  const lead = leading ?? (icon ? <Icon icon={icon} size={15} color="ink" /> : null);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: CHIP_HIT_SLOP, bottom: CHIP_HIT_SLOP }}
      className={`flex-row items-center gap-[5px] rounded-full border pr-md ${
        leading ? 'pl-xs' : 'pl-md'
      } ${selected ? 'border-green-dark bg-green' : 'border-border-control bg-surface'}`}
      style={{ height: CHIP_HEIGHT }}
    >
      {lead}
      <Text className={`text-[13px] text-ink ${selected ? 'font-medium' : 'font-normal'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
