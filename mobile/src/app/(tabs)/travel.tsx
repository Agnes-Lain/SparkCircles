import { useTranslation } from 'react-i18next';

import { useIsGuest } from '../../auth/GateContext';
import { GuestTabScreen } from '../../screens/guest/GuestTabScreen';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function TravelScreen() {
  const { t } = useTranslation();
  // Guests: what Voyages will do, and the invitation to sign up (AC-15.6).
  if (useIsGuest()) return <GuestTabScreen tab="travel" />;
  return <PlaceholderScreen title={t('tabs.travel')} />;
}
