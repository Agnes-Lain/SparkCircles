import { Pressable, Text, View } from 'react-native';

import { shadows } from '../theme/colors';
import { MIN_TOUCH_TARGET } from '../theme/a11y';

export type Segment<K extends string> = { key: K; label: string };

/**
 * Segmented control (design events gap G3): the tab bar container (Surface, radius-lg,
 * padding 4, soft border, level 1); active segment mint Base with Ink text, inactive text
 * mint Dark; 44 px. Exposed as tabs to screen readers.
 */
export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row rounded-lg border-[0.5px] border-border-soft bg-surface p-xs"
      style={{ boxShadow: shadows.card }}
    >
      {segments.map((segment) => {
        const active = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            testID={`segment-${segment.key}`}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.key)}
            className={`flex-1 items-center justify-center rounded-md ${active ? 'bg-green' : ''}`}
            style={{ minHeight: MIN_TOUCH_TARGET }}
          >
            <Text className={`text-body font-medium ${active ? 'text-ink' : 'text-green-dark'}`}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
