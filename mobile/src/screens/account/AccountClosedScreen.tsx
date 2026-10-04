import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { currentLocale } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { MessageScreen } from '../auth/layouts';

/**
 * A8 Account closed (AC-11.2). The server already logged every device out; "OK" forgets the
 * token on this phone and goes to Welcome (S1).
 */
export function AccountClosedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useSession();
  const { date } = useLocalSearchParams<{ date?: string }>();

  const done = async () => {
    await signOut();
    router.replace('/welcome');
  };

  return (
    <MessageScreen
      testID="account-closed-screen"
      title={t('accountClosed.title')}
      body={t('accountClosed.body', { date: date ? formatDate(date, currentLocale()) : '' })}
    >
      <Button size="large" label={t('common.ok')} onPress={() => void done()} testID="ok" />
    </MessageScreen>
  );
}
