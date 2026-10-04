import type { Ref } from 'react';
import { Pressable, Text, type View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';

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
  accessibilityLanguage,
  ref,
  testID,
}: TextLinkProps) {
  const size = small ? 'text-caption' : 'text-body';
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityLanguage={accessibilityLanguage}
      disabled={disabled}
      onPress={onPress}
      className="items-center justify-center"
      style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
    >
      <Text
        className={quiet ? `${size} text-ink-2 underline` : `${size} font-medium text-green-dark`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
