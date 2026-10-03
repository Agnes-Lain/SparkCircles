import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';

/**
 * Layout of the form screens (mockup `signup`: S2, S5, S6, S8): Shell background, 16 px side
 * padding, 24 px between sections, 48 px at the bottom. The keyboard never covers the
 * focused field: on iOS the scroll view adds the keyboard's height to its insets and scrolls
 * the field into view; Android resizes the window (Expo's default) and does the same.
 */
export function FormScreen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-shell" testID={testID}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-xl px-lg pb-3xl pt-lg"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Layout of the message screens (mockup `check-inbox`: S3, S4, S7, S10): a 64 px Surface
 * circle with a line icon, centered H1 and Body, the actions, then an optional quiet link at
 * the very bottom.
 */
export function MessageScreen({
  icon,
  illustration,
  title,
  body,
  children,
  footer,
  onBack,
  testID,
}: {
  /** Back button (44 px, header pattern) for screens reached by a push. */
  onBack?: () => void;
  icon?: LucideIcon;
  /** Replaces the icon circle (e.g. a skeleton while loading). */
  illustration?: ReactNode;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-shell" testID={testID}>
      <ScrollView contentContainerClassName="grow gap-xl px-lg pb-3xl pt-lg">
        {onBack ? (
          <View className="-ml-3 flex-row">
            <IconButton icon={ChevronLeft} accessibilityLabel={t('common.back')} onPress={onBack} />
          </View>
        ) : null}
        <View className="max-h-[72px] grow" />
        <View className="items-center gap-lg">
          {illustration ??
            (icon ? (
              <View className="h-16 w-16 items-center justify-center rounded-full border-[0.5px] border-border-soft bg-surface">
                <Icon icon={icon} size={28} color="ink-2" />
              </View>
            ) : null)}
          <Text accessibilityRole="header" className="text-center text-h1 text-ink">
            {title}
          </Text>
          {typeof body === 'string' ? (
            <Text className="text-center text-body text-ink-2">{body}</Text>
          ) : (
            body
          )}
        </View>
        {children}
        <View className="grow" />
        {footer ? <View className="items-center">{footer}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
