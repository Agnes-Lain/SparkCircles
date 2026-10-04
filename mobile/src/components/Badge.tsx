import type { Ref } from 'react';
import { Pressable, Text, View } from 'react-native';

/** The design system's badge classes (section 6). */
export type BadgeKind =
  'badge-green' | 'badge-lavender' | 'badge-sky' | 'badge-pink' | 'badge-yellow' | 'badge-neutral';

export type BadgeProps = {
  /** The pressable, e.g. so focus can return to it after a sheet closes. */
  ref?: Ref<View>;
  label: string;
  kind: BadgeKind;
  /** Tappable badges (verification) open an explanation sheet. */
  onPress?: () => void;
  /** What screen readers say, e.g. "Verified, identity checked by SparkCircles. Opens…". */
  accessibilityLabel?: string;
  testID?: string;
};

// Design system section 6: Light background + Dark text; neutral is Shell with a soft border.
const KIND: Record<BadgeKind, { box: string; text: string }> = {
  'badge-green': { box: 'bg-green-light', text: 'text-green-dark' },
  'badge-lavender': { box: 'bg-lavender-light', text: 'text-lavender-dark' },
  'badge-sky': { box: 'bg-sky-light', text: 'text-sky-dark' },
  'badge-pink': { box: 'bg-pink-light', text: 'text-pink-dark' },
  'badge-yellow': { box: 'bg-sunny-light', text: 'text-sunny-dark' },
  'badge-neutral': { box: 'bg-shell border-[0.5px] border-border-soft', text: 'text-ink-2' },
};

/**
 * Status badge (design system section 6): 4/10 padding, pill, 11 px / 500. A tappable
 * badge keeps its look but gets a 44 px tap area (design section 5: "badge tap areas padded").
 */
export function Badge({ ref, label, kind, onPress, accessibilityLabel, testID }: BadgeProps) {
  const look = KIND[kind];
  const pill = (
    <View className={`rounded-pill px-2.5 py-1 ${look.box}`}>
      <Text className={`text-[11px] font-medium ${look.text}`}>{label}</Text>
    </View>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={accessibilityLabel ?? label}>
        {pill}
      </View>
    );
  }
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      className="justify-center"
      style={{ minHeight: 24 }}
    >
      {pill}
    </Pressable>
  );
}
