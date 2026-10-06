import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Sticky action bar (design events gap G5): Surface, top soft border, 12/16 padding plus the
 * bottom safe area; one Primary (or a status and a Ghost), caption Ink 3 centred.
 */
export function StickyBar({ children, caption }: { children: ReactNode; caption?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="sticky-bar"
      className="gap-sm border-t-[0.5px] border-border-soft bg-surface px-lg pt-md"
      style={{ paddingBottom: insets.bottom + 12 }}
    >
      {children}
      {caption ? <Text className="text-center text-caption text-ink-3">{caption}</Text> : null}
    </View>
  );
}
