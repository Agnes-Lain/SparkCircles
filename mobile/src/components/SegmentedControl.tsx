import { Pressable, Text, View } from 'react-native';

import { shadows } from '../theme/colors';
import { MIN_TOUCH_TARGET } from '../theme/a11y';

export type Segment<K extends string> = {
  key: K;
  label: string;
  /**
   * My space « Mon compte » (design my-space 1): a 10 px Lavender Dark dot with a white ring
   * after the label, never the only signal; this text is read as the tab's value.
   */
  attention?: string;
};

const LOOK = {
  events: { activeBg: 'bg-green', idleText: 'text-green-dark' },
  community: { activeBg: 'bg-sky', idleText: 'text-sky-dark' },
  mySpace: { activeBg: 'bg-lavender', idleText: 'text-lavender-dark' },
} as const;

/**
 * Segmented control (design events gap G3): the tab bar container (Surface, radius-lg,
 * padding 4, soft border, level 1); active segment mint Base with Ink text, inactive text
 * mint Dark; 44 px. Exposed as tabs to screen readers.
 */
export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  testIDPrefix = 'segment',
  module = 'events',
  tabPosition,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Names the group for screen readers (e.g. a form field's label). */
  accessibilityLabel?: string;
  testIDPrefix?: string;
  /** « onglet 1 sur 2 »: the position read after each tab (design my-space 5). */
  tabPosition?: (position: number, count: number) => string;
  /** Circles (design 11): sky selected; My space (design my-space 1): lavender. */
  module?: keyof typeof LOOK;
}) {
  const { activeBg, idleText } = LOOK[module];
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row rounded-lg border-[0.5px] border-border-soft bg-surface p-xs"
      style={{ boxShadow: shadows.card }}
    >
      {segments.map((segment, index) => {
        const active = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            testID={`${testIDPrefix}-${segment.key}`}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityHint={tabPosition ? tabPosition(index + 1, segments.length) : undefined}
            accessibilityValue={segment.attention ? { text: segment.attention } : undefined}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.key)}
            className={`flex-1 items-center justify-center rounded-md ${active ? activeBg : ''}`}
            style={{ minHeight: MIN_TOUCH_TARGET }}
          >
            <View className="flex-row flex-wrap items-center justify-center gap-xs px-xs">
              <Text
                className={`text-center text-body font-medium ${active ? 'text-ink' : idleText}`}
              >
                {segment.label}
              </Text>
              {segment.attention ? (
                <View
                  testID={`${testIDPrefix}-${segment.key}-dot`}
                  accessible={false}
                  importantForAccessibility="no"
                  className="h-3.5 w-3.5 rounded-full border-2 border-white bg-lavender-dark"
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
