import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

/** Sorties (Events): the default landing tab (design system v1.7, section 17). */
export default function EventsScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.events')} />;
}
