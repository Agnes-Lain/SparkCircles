import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Icon } from '../../components/Icon';

/** `lock` Caption shown on V0 and V4: who sees the photos and when they are erased. */
export function PrivacyNote() {
  const { t } = useTranslation();
  return (
    <View accessible className="flex-row items-start gap-sm">
      <Icon icon={Lock} size={16} color="ink-3" />
      <Text className="flex-1 text-caption text-ink-3">{t('verify.gate.privacy')}</Text>
    </View>
  );
}
