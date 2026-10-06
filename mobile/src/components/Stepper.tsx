import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { Icon } from './Icon';

export type StepperProps = {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  testID?: string;
};

function StepButton({
  icon,
  label,
  disabled,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={`items-center justify-center rounded-full border-[1.5px] ${
        disabled ? 'border-dashed border-ink-3 bg-shell' : 'border-ink-3 bg-surface'
      }`}
      style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
    >
      <Icon icon={icon} size={20} color={disabled ? 'ink-3' : 'ink'} />
    </Pressable>
  );
}

/**
 * Stepper (design events gap G4): label H3 + caption Ink 2 on the left, two 44 px round
 * buttons around the 20/500 value. Screen readers get an adjustable control (spinbutton
 * semantics) with its min, max and value; the buttons stay for touch.
 */
export function Stepper({
  label,
  helper,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  testID,
}: StepperProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  return (
    <View className="flex-row items-center gap-md" testID={testID}>
      <View
        className="flex-1"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, ${helper}`}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment' && canIncrease) onChange(value + 1);
          if (event.nativeEvent.actionName === 'decrement' && canDecrease) onChange(value - 1);
        }}
      >
        <Text className="text-h3 text-ink">{label}</Text>
        <Text className="text-caption text-ink-2">{helper}</Text>
      </View>
      <StepButton
        icon={Minus}
        label={decreaseLabel}
        disabled={!canDecrease}
        onPress={() => onChange(value - 1)}
        testID={testID ? `${testID}-minus` : undefined}
      />
      <Text
        className="min-w-[28px] text-center text-[20px] font-medium text-ink"
        testID={testID ? `${testID}-value` : undefined}
        importantForAccessibility="no"
        accessible={false}
      >
        {value}
      </Text>
      <StepButton
        icon={Plus}
        label={increaseLabel}
        disabled={!canIncrease}
        onPress={() => onChange(value + 1)}
        testID={testID ? `${testID}-plus` : undefined}
      />
    </View>
  );
}
