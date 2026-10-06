import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Button, type ButtonVariant } from '../../components/Button';

type Action = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  testID?: string;
};

/** A confirmation sheet (design E4 to E6): H2, Body, optional content, then two actions. */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  body,
  children,
  primary,
  secondary,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  children?: ReactNode;
  primary: Action;
  secondary: Action;
  testID?: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <View className="gap-xs">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {title}
        </Text>
        {body ? <Text className="text-body text-ink-2">{body}</Text> : null}
      </View>
      {children}
      <View className="gap-sm">
        <Button
          size="large"
          variant={primary.variant ?? 'primary'}
          icon={primary.icon}
          label={primary.label}
          loading={primary.loading}
          onPress={primary.onPress}
          testID={primary.testID}
        />
        <Button
          variant={secondary.variant ?? 'ghost'}
          label={secondary.label}
          onPress={secondary.onPress}
          testID={secondary.testID}
        />
      </View>
    </BottomSheet>
  );
}
