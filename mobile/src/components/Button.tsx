import type { LucideIcon } from 'lucide-react-native';
import { type Ref, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { type ColorToken, colorValue } from '../theme/colors';
import type { Module } from '../navigation/tabs';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'module';
export type ButtonSize = 'large' | 'default' | 'small';

export type ButtonProps = {
  /** The pressable, e.g. so focus can return to it after a sheet closes. */
  ref?: Ref<View>;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Leading line icon (required look for Destructive, design system section 5). */
  icon?: LucideIcon;
  /** Module whose Base color fills a `module` (Module CTA) button, e.g. in empty states. */
  module?: Module;
  /** What screen readers say when the label alone lacks context ("Retake ID card, front"). */
  accessibilityLabel?: string;
  /** Extra accessibility hint, e.g. how to enable a disabled button. */
  accessibilityHint?: string;
  testID?: string;
};

// Class names are written out in full so Tailwind finds them. Every variant has a 1.5 px
// border (transparent unless it shows) so the Primary pressed border appears inside the
// pill without resizing it (QA BUG-09), and all variants share the same height.
const VARIANT: Record<
  Exclude<ButtonVariant, 'module'>,
  { box: string; text: string; tint: ColorToken }
> = {
  primary: { box: 'bg-green border-[1.5px] border-transparent', text: 'text-ink', tint: 'ink' },
  secondary: {
    box: 'bg-green-light border-[1.5px] border-transparent',
    text: 'text-green-dark',
    tint: 'green-dark',
  },
  ghost: {
    box: 'bg-transparent border-[1.5px] border-green-dark',
    text: 'text-green-dark',
    tint: 'green-dark',
  },
  destructive: {
    box: 'bg-error-dark border-[1.5px] border-transparent',
    text: 'text-white',
    tint: 'white',
  },
};

// Module CTA (section 5): module Base fill, Ink text (contrast rule 2).
const MODULE_FILL: Record<Module, string> = {
  home: 'bg-lavender',
  events: 'bg-green',
  community: 'bg-sky',
  market: 'bg-pink',
  travel: 'bg-sunny',
};

function variantLook(variant: ButtonVariant, module: Module | undefined) {
  if (variant !== 'module') return VARIANT[variant];
  if (!module) throw new Error('A Module CTA button needs its `module`.');
  return {
    box: `${MODULE_FILL[module]} border-[1.5px] border-transparent`,
    text: 'text-ink',
    tint: 'ink' as ColorToken,
  };
}

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
  module,
  accessibilityLabel,
  accessibilityHint,
  ref,
  testID,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const solidDisabled = disabled && (variant === 'primary' || variant === 'destructive');
  const base = variantLook(variant, module);
  const look = solidDisabled ? DISABLED_SOLID : base;
  const tint: ColorToken = solidDisabled ? 'ink-3' : base.tint;
  // Primary pressed: the reserved transparent border turns green-dark (inset, no resize).
  const box =
    pressed && variant === 'primary'
      ? look.box.replace('border-transparent', 'border-green-dark')
      : look.box;
  const fade = disabled && !solidDisabled ? 'opacity-40' : '';

  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={`flex-row items-center justify-center rounded-pill ${SIZE[size].box} ${box} ${fade}`}
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
