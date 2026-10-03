import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react-native';
import { Trans, useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { useLogOut } from '../../auth/useLogOut';
import { ME_KEY, useMe } from '../../auth/useMe';
import { Button } from '../../components/Button';
import { Notification } from '../../components/Notification';
import { useToast } from '../../components/ToastProvider';
import { currentLocale } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { MessageScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';

/** S10 Closure in progress (AC-11.3): log in during the 30-day grace period. */
export function ClosureScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const logOut = useLogOut();
  const { showToast } = useToast();
  const erasureOn = me.data?.closure?.erasure_on;

  const keep = useMutation({
    mutationFn: () => auth().cancelClosure(),
    onSuccess: (account) => {
      queryClient.setQueryData(ME_KEY, account);
      showToast(t('closure.restored'));
    },
  });
  const sendKeep = useSubmitOnce(keep);

  const error = keep.error instanceof ApiError ? keep.error : null;

  return (
    <MessageScreen
      testID="closure-screen"
      icon={CalendarClock}
      title={t('closure.title')}
      body={
        erasureOn ? (
          <Text className="text-center text-body text-ink-2">
            <Trans
              i18nKey="closure.body"
              values={{ date: formatDate(erasureOn, currentLocale()) }}
              components={{ b: <Text className="font-medium text-ink" /> }}
            />
          </Text>
        ) : undefined
      }
    >
      {error?.code === 'rate_limited' ? (
        <Notification level="error" title={error.message} />
      ) : error ? (
        <UnreachableNotification onRetry={() => sendKeep()} retrying={keep.isPending} />
      ) : null}
      <View className="gap-md">
        <Button
          size="large"
          label={t('closure.keep')}
          loading={keep.isPending}
          onPress={() => sendKeep()}
          testID="keep"
        />
        <Button
          size="large"
          variant="ghost"
          label={t('common.logOut')}
          onPress={() => void logOut()}
        />
      </View>
    </MessageScreen>
  );
}
