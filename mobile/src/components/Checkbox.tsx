import { Check, CircleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type AccessibilityActionEvent, Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { Icon } from './Icon';

export type CheckboxLink = { label: string; onPress: () => void };

export type CheckboxProps = {
  /** What screen readers read: the full label as plain text. */
  accessibilityLabel: string;
  /** What is shown; may contain inline links (Text with onPress). */
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
  /** Inline links, also offered to screen readers as actions of the checkbox. */
  links?: CheckboxLink[];
  testID?: string;
};

/**
 * Checkbox row (design system section 8): full-width tappable row, ≥ 44 px, 24 px box with a
 * 1.5 px Ink 3 border; checked = green-dark fill with a white check. Unticked by default for
 * any consent (the parent decides).
 */
export function Checkbox({
  accessibilityLabel,
  label,
  checked,
  onChange,
  error,
  links = [],
  testID,
}: CheckboxProps) {
  const box = checked
    ? 'bg-green-dark border-green-dark'
    : error
      ? 'bg-surface border-error-dark'
      : 'bg-surface border-ink-3';

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate') onChange(!checked);
    links.find((link) => link.label === event.nativeEvent.actionName)?.onPress();
  };

  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel={error ? `${accessibilityLabel}. ${error}` : accessibilityLabel}
        accessibilityState={{ checked }}
        accessibilityActions={[
          { name: 'activate' },
          ...links.map((link) => ({ name: link.label, label: link.label })),
        ]}
        onAccessibilityAction={onAccessibilityAction}
        onPress={() => onChange(!checked)}
        className="flex-row items-start gap-md py-2.5"
        style={{ minHeight: MIN_TOUCH_TARGET }}
      >
        <View className={`h-6 w-6 items-center justify-center rounded-sm border-[1.5px] ${box}`}>
          {checked ? <Icon icon={Check} size={16} color="white" /> : null}
        </View>
        <View className="flex-1">
          {typeof label === 'string' ? <Text className="text-body text-ink">{label}</Text> : label}
        </View>
      </Pressable>
      {error ? (
        <View
          className="flex-row items-center gap-xs pl-9"
          testID={testID ? `${testID}-error` : undefined}
        >
          <Icon icon={CircleAlert} size={14} color="error-dark" />
          <Text className="flex-1 text-caption text-error-dark">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
