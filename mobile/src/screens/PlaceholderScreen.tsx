import type { ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Temporary screen for a tab whose feature isn't built yet: the tab name as H1, nothing
 * else (no invented copy). Replaced feature by feature.
 */
export function PlaceholderScreen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-shell">
      <ScrollView contentContainerClassName="px-lg pb-3xl pt-xl">
        <Text accessibilityRole="header" className="text-h1 text-ink">
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
