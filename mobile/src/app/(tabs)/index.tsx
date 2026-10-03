import { useTranslation } from 'react-i18next';

import { api } from '../../api';
import { ApiHealthCheck } from '../../screens/dev/ApiHealthCheck';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t('tabs.home')}>
      {__DEV__ ? <ApiHealthCheck client={api} /> : null}
    </PlaceholderScreen>
  );
}
