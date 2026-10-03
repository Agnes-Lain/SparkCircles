import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { type ColorToken, colorValue } from '../theme/colors';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'large' | 'default' | 'small';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Leading line icon (required look for Destructive, design system section 5). */
  icon?: LucideIcon;
  /** Extra accessibility hint, e.g. how to enable a disabled button. */
  accessibilityHint?: string;
  testID?: string;
};

// Class names are written out in full so Tailwind finds them.
const VARIANT: Record<ButtonVariant, { box: string; text: string; tint: ColorToken }> = {
  primary: { box: 'bg-green', text: 'text-ink', tint: 'ink' },
  secondary: { box: 'bg-green-light', text: 'text-green-dark', tint: 'green-dark' },
  ghost: {
    box: 'bg-transparent border-[1.5px] border-green-dark',
    text: 'text-green-dark',
    tint: 'green-dark',
  },
  destructive: { box: 'bg-error-dark', text: 'text-white', tint: 'white' },
};

// Large 14/28 · 15px, Default 10/20 · 14px, Small 7/14 · 12px; all 500 weight.
const SIZE: Record<ButtonSize, { box: string; text: string }> = {
  large: { box: 'px-7 py-3.5', text: 'text-[15px] font-medium' },
  default: { box: 'px-5 py-2.5', text: 'text-body font-medium' },
  small: { box: 'px-3.5 py-[7px]', text: 'text-caption font-medium' },
};

// Disabled Primary and Destructive: Shell fill, dashed Ink 3 border, Ink 3 text (v1.3).
const DISABLED_SOLID = {
  box: 'bg-shell border-[1.5px] border-dashed border-ink-3',
  text: 'text-ink-3',
};

/**
 * Pill button (design system section 5). Pressed: scale 0.97, plus a 1.5 px green-dark
 * inset border on Primary. Loading: inline spinner, text hidden, same width.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const solidDisabled = disabled && (variant === 'primary' || variant === 'destructive');
  const look = solidDisabled ? DISABLED_SOLID : VARIANT[variant];
  const tint: ColorToken = solidDisabled ? 'ink-3' : VARIANT[variant].tint;
  const pressedBorder = pressed && variant === 'primary' ? 'border-[1.5px] border-green-dark' : '';
  const fade = disabled && !solidDisabled ? 'opacity-40' : '';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={`flex-row items-center justify-center rounded-pill ${SIZE[size].box} ${look.box} ${pressedBorder} ${fade}`}
      style={{ minHeight: MIN_TOUCH_TARGET, transform: [{ scale: pressed ? 0.97 : 1 }] }}
    >
      <View className="flex-row items-center" style={{ opacity: loading ? 0 : 1 }}>
        {icon ? (
          <View className="mr-sm">
            <Icon icon={icon} size={size === 'small' ? 16 : 20} color={tint} />
          </View>
        ) : null}
        <Text className={`${SIZE[size].text} ${look.text}`}>{label}</Text>
      </View>
      {loading ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={colorValue(tint)} />
        </View>
      ) : null}
    </Pressable>
  );
}
