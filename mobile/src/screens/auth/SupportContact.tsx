import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

/**
 * The support contact (design addendum D-4, D-8, question Q5). The channel isn't decided yet,
 * so it comes from a single i18n key per language (`support.contact`), replaced later.
 */
export function SupportContact({ centered = false }: { centered?: boolean }) {
  const { t } = useTranslation();
  return (
    <Text
      testID="support-contact"
      className={`text-body font-medium text-ink ${centered ? 'text-center' : ''}`}
    >
      {t('support.contact')}
    </Text>
  );
}
