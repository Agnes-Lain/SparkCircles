import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { account, auth } from '../../api';
import { LEGAL_KEY } from '../../api/auth';
import type { ApiError } from '../../api/errors';
import type { Legal } from '../../api/types';
import { ME_KEY, useMe } from '../../auth/useMe';
import { Checkbox } from '../../components/Checkbox';
import { Header } from '../../components/Header';
import { SettingsList } from '../../components/SettingsList';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';
import { currentLocale } from '../../i18n';
import { formatMomentDate } from '../../i18n/format';
import { openLegalDocument } from '../auth/external';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';

/**
 * A4 Privacy and messages (AC-5.2, 5.4): the marketing choice saves at once ("Saved"), and
 * the accepted versions of the terms and privacy policy, which open in the in-app browser.
 * A skeleton shows while the account loads (M-7).
 */
export function PrivacyScreen() {
  const { t } = useTranslation();
  const back = useBack('/account');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const me = useMe();
  const legal = useQuery<Legal, ApiError>({
    queryKey: LEGAL_KEY,
    queryFn: ({ signal }) => auth().legal(signal),
    retry: false,
  });

  const marketing = useMutation({
    mutationFn: (optIn: boolean) => account().setMarketing(optIn),
    onSuccess: (updated) => {
      queryClient.setQueryData(ME_KEY, updated);
      showToast(t('common.saved'));
    },
  });

  const locale = currentLocale();
  const user = me.data;
  // While saving, the box shows the new choice; after a failure, the saved one again.
  const checked = marketing.isPending
    ? Boolean(marketing.variables)
    : (user?.marketing_opt_in ?? false);

  return (
    <FormScreen testID="privacy-screen">
      <Header title={t('privacy.title')} onBack={back} />

      {marketing.isError ? (
        <UnreachableNotification
          onRetry={() => marketing.mutate(!user?.marketing_opt_in)}
          retrying={marketing.isPending}
        />
      ) : null}

      {user ? (
        <>
          <View>
            <Checkbox
              testID="marketing"
              accessibilityLabel={t('signUp.marketing')}
              label={t('signUp.marketing')}
              checked={checked}
              onChange={(value) => {
                if (!marketing.isPending) marketing.mutate(value);
              }}
            />
            {user.marketing_opt_in_changed_at ? (
              <Text className="pl-9 text-caption text-ink-3">
                {t('privacy.changedOn', {
                  date: formatMomentDate(user.marketing_opt_in_changed_at, locale),
                })}
              </Text>
            ) : null}
          </View>

          <SettingsList
            items={[
              {
                key: 'terms',
                label: t('privacy.terms'),
                caption: t('privacy.termsAccepted', {
                  date: formatMomentDate(user.consents.terms_accepted_at, locale),
                  version: user.consents.terms_version,
                }),
                onPress: legal.data
                  ? () => void openLegalDocument(legal.data.terms.url)
                  : undefined,
                testID: 'terms',
              },
              {
                key: 'privacy',
                label: t('privacy.privacyPolicy'),
                caption: t('privacy.privacyAccepted', {
                  date: formatMomentDate(user.consents.privacy_accepted_at, locale),
                  version: user.consents.privacy_version,
                }),
                onPress: legal.data
                  ? () => void openLegalDocument(legal.data.privacy.url)
                  : undefined,
                testID: 'privacy',
              },
            ]}
          />
        </>
      ) : me.isError ? (
        <UnreachableNotification onRetry={() => void me.refetch()} retrying={me.isFetching} />
      ) : (
        <View
          accessible
          accessibilityLabel={t('common.oneMoment')}
          className="gap-lg"
          testID="privacy-loading"
        >
          <Skeleton width="90%" height={20} />
          <Skeleton width="100%" height={52} />
          <Skeleton width="100%" height={52} />
        </View>
      )}
    </FormScreen>
  );
}
