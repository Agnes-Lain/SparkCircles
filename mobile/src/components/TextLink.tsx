import type { LucideIcon } from 'lucide-react-native';
import type { Ref } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { Icon } from './Icon';

export type TextLinkProps = {
  /** The pressable, e.g. so focus can return to it after a sheet closes. */
  ref?: Ref<View>;
  label: string;
  onPress: () => void;
  /** Quiet link: Body Ink 2, underlined ("Log out" under a screen). */
  quiet?: boolean;
  /** Caption-size link (the Welcome language switch, design system section 18). */
  small?: boolean;
  disabled?: boolean;
  /** Leading line icon, 16 px in the label colour with a 4 px gap (guest « Créer ma sortie »). */
  icon?: LucideIcon;
  /** Icon size in px (default 16; 18 for the « Ajouter à mon calendrier » row). */
  iconSize?: number;
  /** Screen reader label when it says more than the visible label (default: the label). */
  accessibilityLabel?: string;
  /** 'button' when the link triggers an action rather than navigating (default 'link'). */
  accessibilityRole?: 'link' | 'button';
  /** Language of the label when it differs from the app's (VoiceOver pronunciation). */
  accessibilityLanguage?: string;
  testID?: string;
};

/** Text link (design system section 5): Body 14/500 green-dark, a 44×44 px target at least. */
export function TextLink({
  label,
  onPress,
  quiet = false,
  small = false,
  disabled = false,
  icon,
  iconSize = 16,
  accessibilityLabel,
  accessibilityRole = 'link',
  accessibilityLanguage,
  ref,
  testID,
}: TextLinkProps) {
  const size = small ? 'text-caption' : 'text-body';
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      accessibilityLanguage={accessibilityLanguage}
      disabled={disabled}
      onPress={onPress}
      className="items-center justify-center"
      style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
    >
      <View className="flex-row items-center gap-xs">
        {icon ? <Icon icon={icon} size={iconSize} color={quiet ? 'ink-2' : 'green-dark'} /> : null}
        <Text
          className={quiet ? `${size} text-ink-2 underline` : `${size} font-medium text-green-dark`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
