import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function CommunityScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.community')} />;
}
