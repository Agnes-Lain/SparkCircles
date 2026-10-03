import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { IconButton } from './IconButton';

export type HeaderProps = {
  title: string;
  /** Shows the 44 px back button above the title (pushed screens). */
  onBack?: () => void;
  /** Optional step counter, right-aligned on the back button's row ("Step 2 of 4"). */
  step?: string;
  /** Optional Body text under the title. */
  intro?: ReactNode;
};

/** Header of pushed screens (design system section 10): back button, then the H1 title. */
export function Header({ title, onBack, step, intro }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-sm">
      {onBack || step ? (
        <View className="-ml-3 flex-row items-center justify-between">
          {onBack ? (
            <IconButton icon={ChevronLeft} accessibilityLabel={t('common.back')} onPress={onBack} />
          ) : (
            <View />
          )}
          {step ? <Text className="text-caption text-ink-3">{step}</Text> : null}
        </View>
      ) : null}
      <Text accessibilityRole="header" className="text-h1 text-ink">
        {title}
      </Text>
      {typeof intro === 'string' ? <Text className="text-body text-ink-2">{intro}</Text> : intro}
    </View>
  );
}
