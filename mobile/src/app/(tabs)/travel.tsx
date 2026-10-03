import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function TravelScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.travel')} />;
}
