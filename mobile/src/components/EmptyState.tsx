import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Empty state (design system section 12): module Light background, 32 px emoji, H2, Body,
 * then the actions (a Module CTA and an optional text link). The emoji is decorative.
 */
export function EmptyState({
  title,
  body,
  emoji = '🦄',
  children,
  testID,
}: {
  title: string;
  body: string;
  emoji?: string;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} className="items-center gap-md rounded-lg bg-green-light px-lg py-xl">
      <Text className="text-[32px]" accessible={false} importantForAccessibility="no">
        {emoji}
      </Text>
      <Text accessibilityRole="header" className="text-center text-h2 text-ink">
        {title}
      </Text>
      <Text className="text-center text-body text-ink-2">{body}</Text>
      {children ? <View className="items-center gap-xs self-stretch">{children}</View> : null}
    </View>
  );
}
