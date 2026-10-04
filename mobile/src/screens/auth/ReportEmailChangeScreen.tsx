import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Clock, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { useAfterMount } from '../../auth/useAfterMount';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { MessageScreen } from './layouts';
import { LinkPending } from './LinkPending';
import { UnreachableNotification } from './UnreachableNotification';
import { SupportContact } from './SupportContact';
import { useSubmitOnce } from './useSubmitOnce';
import { useLinkToken } from './useLinkToken';

/**
 * Target of the "This wasn't me" link sent to the old address after an email change
 * (`/this-wasnt-me?token=…`, AC-13.7, 13.8). Works without logging in: the account is secured
 * at once (every device logged out, account locked, report sent to the team).
 * Three end states (D-4): secured, already reported (link opened again), expired.
 */
export function ReportEmailChangeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useLinkToken();
  const { status, signOut } = useSession();

  const report = useMutation({
    mutationFn: (value: string) => auth().reportEmailChange(value),
    // Every device of the account is logged out: forget this one's token too, if it has one.
    onSuccess: async () => {
      if (status === 'signedIn') await signOut();
    },
  });
  const sendReport = useSubmitOnce(report);

  useAfterMount(() => {
    if (token) sendReport(token);
  });

  const error = report.error instanceof ApiError ? report.error : null;
  const expired =
    !token || error?.code === 'invalid_or_expired_token' || error?.code === 'bad_request';
  const leave = () => router.replace('/');

  if (report.data?.status === 'already_reported') {
    return (
      <MessageScreen
        testID="report-already-screen"
        icon={Clock}
        title={t('report.alreadyTitle')}
        body={t('report.alreadyBody')}
      >
        <Button size="large" label={t('common.ok')} onPress={leave} />
      </MessageScreen>
    );
  }

  if (report.isSuccess) {
    return (
      <MessageScreen
        testID="report-secured-screen"
        icon={ShieldCheck}
        title={t('report.securedTitle')}
        body={
          <View className="gap-sm">
            <Text className="text-center text-body text-ink-2">{t('report.securedBody')}</Text>
            <Text className="text-center text-caption text-ink-3">
              {t('report.securedCaption')}
            </Text>
          </View>
        }
      >
        <Button size="large" label={t('common.ok')} onPress={leave} />
      </MessageScreen>
    );
  }

  if (expired) {
    return (
      <MessageScreen
        testID="report-expired-screen"
        icon={Clock}
        title={t('linkExpired.title')}
        body={
          <View className="gap-sm">
            <Text className="text-center text-body text-ink-2">{t('report.expiredBody')}</Text>
            <Text className="text-center text-body text-ink-2">{t('report.expiredHelp')}</Text>
            <SupportContact centered />
          </View>
        }
      >
        <Button size="large" label={t('common.ok')} onPress={leave} />
      </MessageScreen>
    );
  }

  return (
    <LinkPending>
      {error ? (
        <UnreachableNotification
          onRetry={() => token && sendReport(token)}
          retrying={report.isPending}
        />
      ) : null}
    </LinkPending>
  );
}
