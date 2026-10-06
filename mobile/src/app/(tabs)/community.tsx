import { useTranslation } from 'react-i18next';

import { useIsGuest } from '../../auth/GateContext';
import { GuestTabScreen } from '../../screens/guest/GuestTabScreen';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function CommunityScreen() {
  const { t } = useTranslation();
  // Guests: what Cercles will do, and the invitation to sign up (AC-15.6).
  if (useIsGuest()) return <GuestTabScreen tab="community" />;
  return <PlaceholderScreen title={t('tabs.community')} />;
}
