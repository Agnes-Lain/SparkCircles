import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode, Ref } from 'react';
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
  /** H2 title instead of H1 (the verification capture steps, design V2–V4). */
  small?: boolean;
  /** Ref to the title, to move the screen reader's focus to it when the step changes. */
  titleRef?: Ref<Text>;
};

/** Header of pushed screens (design system section 10): back button, then the H1 title. */
export function Header({ title, onBack, step, intro, small = false, titleRef }: HeaderProps) {
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
          {step ? (
            <Text accessibilityLiveRegion="polite" className="text-caption text-ink-3">
              {step}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text
        ref={titleRef}
        accessibilityRole="header"
        className={`${small ? 'text-h2' : 'text-h1'} text-ink`}
      >
        {title}
      </Text>
      {typeof intro === 'string' ? <Text className="text-body text-ink-2">{intro}</Text> : intro}
    </View>
  );
}
