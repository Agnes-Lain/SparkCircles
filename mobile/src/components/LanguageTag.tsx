import { Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { EventLanguage } from '../api/events';
import { resolveLocale } from '../i18n';
import { Icon } from './Icon';

/**
 * AC-16.2 (design events, addendum "event language"): a small neutral tag after the category
 * pill when the event's language differs from the app's: `globe` 14 px + « En anglais » /
 * "In French", Ink 2 on #F0F0F0 (`other-light`), pill, 12 px. Nothing when they match.
 */
export function LanguageTag({
  language,
  testID,
}: {
  language: EventLanguage | null | undefined;
  testID?: string;
}) {
  const { t, i18n } = useTranslation();
  if (!language || language === resolveLocale(i18n.language)) return null;
  return (
    <View
      testID={testID ?? 'language-tag'}
      accessible
      accessibilityLabel={t(`events.language.a11y.${language}`)}
      className="flex-row items-center gap-xs rounded-pill bg-other-light px-2.5 py-1"
    >
      <Icon icon={Globe} size={14} color="ink-2" />
      <Text className="text-caption text-ink-2">{t(`events.language.tag.${language}`)}</Text>
    </View>
  );
}
