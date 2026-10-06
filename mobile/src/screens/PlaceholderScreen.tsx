import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Temporary screen for a tab whose feature isn't built yet: the tab name as H1, nothing
 * else (no invented copy). Replaced feature by feature.
 */
export function PlaceholderScreen({
  title,
  children,
  headerRight,
}: {
  title: string;
  children?: ReactNode;
  /** Shown at the top right of the title row (My space: the notifications bell and the "My account" avatar). */
  headerRight?: ReactNode;
}) {
  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <ScrollView contentContainerClassName="px-lg pb-3xl pt-xl">
        <View className="flex-row items-center justify-between gap-md">
          <Text accessibilityRole="header" className="flex-1 text-h1 text-ink">
            {title}
          </Text>
          {headerRight}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
