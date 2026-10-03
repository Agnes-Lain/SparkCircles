import { Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { openMailApp } from './external';
import { MessageScreen } from './layouts';
import { useBack } from './useBack';

/** S7 Link sent (AC-4.1): always the same neutral message. */
export function LinkSentScreen() {
  const { t } = useTranslation();
  const back = useBack('/log-in');
  return (
    <MessageScreen
      testID="link-sent-screen"
      icon={Mail}
      title={t('linkSent.title')}
      body={t('linkSent.body')}
      onBack={back}
    >
      <Button size="large" label={t('common.openMailApp')} onPress={() => void openMailApp()} />
    </MessageScreen>
  );
}
