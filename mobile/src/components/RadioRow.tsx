import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export type RadioRowProps = {
  label: string;
  helper?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Optional leading element (a category icon square). */
  leading?: ReactNode;
  testID?: string;
};

/**
 * Radio list row (design events section 4.3): 52 px row, 24 px circle with a 1.5 px Ink 3
 * border; selected = green-dark ring and dot. The label (and helper) name the choice.
 */
export function RadioRow({
  label,
  helper,
  selected,
  onPress,
  disabled = false,
  leading,
  testID,
}: RadioRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={helper ? `${label}. ${helper}` : label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-md py-sm ${disabled ? 'opacity-60' : ''}`}
      style={{ minHeight: 52 }}
    >
      {leading}
      <View className="flex-1">
        <Text className="text-body font-medium text-ink">{label}</Text>
        {helper ? <Text className="text-caption text-ink-3">{helper}</Text> : null}
      </View>
      <View
        className={`h-6 w-6 items-center justify-center rounded-full border-[1.5px] ${
          selected ? 'border-green-dark' : 'border-ink-3'
        }`}
      >
        {selected ? <View className="h-3 w-3 rounded-full bg-green-dark" /> : null}
      </View>
    </Pressable>
  );
}
