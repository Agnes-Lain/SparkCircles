import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { auth } from '../../api';
import { LEGAL_KEY } from '../../api/auth';
import { ApiError } from '../../api/errors';
import type { Legal } from '../../api/types';
import { useLogOut } from '../../auth/useLogOut';
import { ME_KEY } from '../../auth/useMe';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { Skeleton } from '../../components/Skeleton';
import { TextLink } from '../../components/TextLink';
import { openLegalDocument } from './external';
import { FormScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';

/**
 * S9 Terms updated (AC-5.5, 5.2): blocks the app until the new versions are accepted.
 * The design's Ghost "I don't accept" leads to Close my account (A7), which arrives with the
 * My account PR; until then the quiet "Log out" link is the way out.
 */
export function TermsUpdatedScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const logOut = useLogOut();

  const legal = useQuery<Legal, ApiError>({
    queryKey: LEGAL_KEY,
    queryFn: ({ signal }) => auth().legal(signal),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: (current: Legal) =>
      auth().acceptTerms(current.terms.version, current.privacy.version),
    // The gate sees terms_acceptance_required: false and opens the tabs.
    onSuccess: (me) => queryClient.setQueryData(ME_KEY, me),
  });
  const sendAccept = useSubmitOnce(accept);

  const acceptError = accept.error instanceof ApiError ? accept.error : null;

  return (
    <FormScreen testID="terms-updated-screen">
      <Header title={t('terms.title')} intro={t('terms.intro')} />

      {legal.isPending ? (
        <View
          accessible
          accessibilityLabel={t('common.oneMoment')}
          className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
          testID="terms-loading"
        >
          <Skeleton width="90%" height={14} />
          <Skeleton width="75%" height={14} />
          <Skeleton width="80%" height={14} />
        </View>
      ) : legal.isError ? (
        <UnreachableNotification onRetry={() => void legal.refetch()} retrying={legal.isFetching} />
      ) : (
        <View className="gap-sm">
          {legal.data.changes.length > 0 ? (
            <View className="gap-sm rounded-lg border-[0.5px] border-border-soft bg-surface p-lg">
              {legal.data.changes.map((change) => (
                <View key={change} className="flex-row gap-sm">
                  <Text className="text-body text-ink">•</Text>
                  <Text className="flex-1 text-body text-ink">{change}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View className="items-start">
            <TextLink
              label={t('terms.readTerms')}
              onPress={() => void openLegalDocument(legal.data.terms.url)}
            />
            <TextLink
              label={t('terms.readPrivacy')}
              onPress={() => void openLegalDocument(legal.data.privacy.url)}
            />
          </View>
        </View>
      )}

      {acceptError?.code === 'rate_limited' ? (
        <Notification level="error" title={acceptError.message} />
      ) : acceptError?.code === 'validation_failed' ? (
        // The versions changed again meanwhile: reload them before accepting.
        <UnreachableNotification onRetry={() => void legal.refetch()} retrying={legal.isFetching} />
      ) : acceptError ? (
        <UnreachableNotification
          onRetry={() => legal.data && sendAccept(legal.data)}
          retrying={accept.isPending}
        />
      ) : null}

      <View className="gap-sm">
        <Button
          size="large"
          label={t('terms.accept')}
          disabled={!legal.data}
          loading={accept.isPending}
          onPress={() => legal.data && sendAccept(legal.data)}
          testID="accept"
        />
        <View className="items-center">
          <TextLink quiet label={t('common.logOut')} onPress={() => void logOut()} />
        </View>
      </View>
    </FormScreen>
  );
}
