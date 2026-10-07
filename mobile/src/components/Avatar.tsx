import { Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

// Design system section 11: SM 24 / 10 px, MD 36 / 13 px, LG 44 / 15 px, round.
const SIZE: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: 'h-6 w-6', text: 'text-[10px]' },
  md: { box: 'h-9 w-9', text: 'text-[13px]' },
  lg: { box: 'h-11 w-11', text: 'text-[15px]' },
  // My space « Mon compte » profile card (design my-space 3): 64 px.
  xl: { box: 'h-16 w-16', text: 'text-h2' },
};

// Rotating Light / Dark pairs: lavender, green, pink, sky, sunny.
const PAIRS = [
  'bg-lavender-light text-lavender-dark',
  'bg-green-light text-green-dark',
  'bg-pink-light text-pink-dark',
  'bg-sky-light text-sky-dark',
  'bg-sunny-light text-sunny-dark',
];

/** Picks the same color pair for the same person every time. */
export function avatarPair(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [bg = '', text = ''] = (PAIRS[hash % PAIRS.length] ?? PAIRS[0]!).split(' ');
  return { bg, text };
}

export type AvatarProps = {
  /** The first name: its first letter is shown (mockups `account`, `profile-preview`). */
  name: string;
  /** Stable seed for the color (the account id). */
  seed: string;
  size?: AvatarSize;
  /** Makes it the "My account" entry button (design system section 10). */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

/** Initials avatar (design system section 11). Decorative unless it is a button. */
export function Avatar({
  name,
  seed,
  size = 'lg',
  onPress,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const pair = avatarPair(seed);
  const circle = (
    <View
      className={`items-center justify-center rounded-full ${SIZE[size].box} ${pair.bg}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Text className={`font-medium ${SIZE[size].text} ${pair.text}`}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
  if (!onPress) return circle;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="items-center justify-center"
      style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET }}
    >
      {circle}
    </Pressable>
  );
}
