import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { circles } from '../../api';
import type { InvitationKey } from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { useIsGuest } from '../../auth/GateContext';
import { useMe } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { FormScreen, MessageScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { useGuestAccount } from '../guest/useGuestAccount';
import { Card, CardsSkeleton, FamiliesLine, TypeLine, VerifiedBadge } from './CircleParts';
import { displayName, refreshCircles, useInvitationPreview } from './queries';

/**
 * C4b Join preview and C4c request sent (AC-3.1 to AC-3.5, AC-2.3, AC-2.7, design 4c to 4g),
 * from an invitation link (`/join/<token>`) or a typed code (`/circles/join?code=…`). Name,
 * area, families and the admin with badge; never the description or the members. A blocked
 * person sees the same "Demande envoyée" (no request is created, AC-2.7).
 */
export function JoinPreviewScreen() {
  const params = useLocalSearchParams<{ token?: string; code?: string; then?: string }>();
  const key: InvitationKey | null = params.token
    ? { token: params.token }
    : params.code
      ? { code: params.code }
      : null;
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/community');
  const guest = useIsGuest();
  const me = useMe();
  const account = useGuestAccount();
  const queryClient = useQueryClient();
  const query = useInvitationPreview(key);
  const [sent, setSent] = useState(false);
  const join = useMutation<unknown, ApiError, void>({
    mutationFn: () => circles().joinByInvitation(key!),
    onSuccess: () => {
      setSent(true);
      refreshCircles(queryClient);
    },
  });
  const seeCircles = () => router.replace('/community');

  if (sent) {
    return (
      <MessageScreen
        testID="join-sent"
        illustration={<SuccessCheckmark />}
        title={t('circles.join.sentTitle')}
        body={t('circles.join.sentBody')}
      >
        <Button size="large" label={t('circles.join.seeCircles')} onPress={seeCircles} />
      </MessageScreen>
    );
  }

  const failure = query.error ?? null;
  if (
    !key ||
    failure?.code === 'invitation_invalid' ||
    failure?.code === 'too_many_tries' ||
    failure?.status === 404
  ) {
    return (
      <MessageScreen
        testID="join-invalid"
        onBack={back}
        icon={Link2}
        title={
          failure?.code === 'too_many_tries' ? t('circles.join.tooMany') : t('circles.join.invalid')
        }
      >
        <Button variant="ghost" label={t('circles.join.seeCircles')} onPress={seeCircles} />
      </MessageScreen>
    );
  }

  const preview = query.data;
  const verified = me.data?.verification.verified ?? false;
  const joinError = join.error;
  const blocker = preview?.viewer.request_blocker ?? null;

  let action;
  if (!preview) {
    action = null;
  } else if (guest) {
    action = (
      <>
        <Text className="text-body text-ink-2">{t('circles.join.guestBody')}</Text>
        <Button
          size="large"
          label={t('circles.join.createAccount')}
          onPress={() => params.token && account.signUp({ invitation: { token: params.token } })}
          testID="join-sign-up"
        />
        <Button
          variant="ghost"
          label={t('circles.join.haveAccount')}
          onPress={() => params.token && account.logIn({ invitation: { token: params.token } })}
          testID="join-log-in"
        />
      </>
    );
  } else if (blocker === 'member' || blocker === 'pending') {
    action = (
      <>
        <Notification
          level="community"
          title={
            blocker === 'member'
              ? t('circles.join.alreadyMember')
              : t('circles.join.alreadyPending')
          }
          testID="join-own-status"
        />
        <Button variant="ghost" label={t('circles.join.seeCircles')} onPress={seeCircles} />
      </>
    );
  } else if (blocker === 'full' || joinError?.code === 'circle_full') {
    action = <Notification level="reminder" title={t('circles.join.full')} testID="join-full" />;
  } else if (blocker === 'member_limit' || joinError?.code === 'circle_member_limit') {
    action = <Notification level="reminder" title={t('circles.join.limit')} testID="join-limit" />;
  } else {
    action = (
      <>
        {joinError ? (
          <Notification
            level="error"
            title={
              joinError.isOffline
                ? t('circles.join.offline')
                : joinError.code === 'too_many_tries' || joinError.code === 'rate_limited'
                  ? t('circles.join.tooMany')
                  : joinError.code === 'invitation_invalid'
                    ? t('circles.join.invalid')
                    : joinError.message
            }
            testID="join-error"
          />
        ) : null}
        {!verified ? (
          <Notification
            level="community"
            title={t('circles.join.unverifiedTitle')}
            caption={t('circles.join.unverifiedBody')}
            testID="join-unverified"
          />
        ) : null}
        <Button
          size="large"
          label={t('circles.join.ask')}
          loading={join.isPending}
          onPress={() => join.mutate()}
          testID="join-ask"
        />
        {!verified ? (
          <Button
            variant="ghost"
            label={t('circles.join.verify')}
            onPress={() => router.push('/verify')}
          />
        ) : null}
      </>
    );
  }

  return (
    <FormScreen testID="join-preview">
      <Header title={t('circles.join.invited')} onBack={back} small />
      {params.then === 'request' && !guest ? (
        <Notification
          level="confirmed"
          title={t('circles.join.readyTitle')}
          caption={t('circles.join.readyBody')}
          testID="join-ready"
        />
      ) : null}
      {!preview ? (
        failure ? (
          <Notification
            level="error"
            title={failure.isOffline ? t('circles.join.offline') : t('errors.unreachable.title')}
            action={
              <Button
                variant="secondary"
                size="small"
                label={t('errors.tryAgain')}
                onPress={() => void query.refetch()}
              />
            }
            testID="join-load-error"
          />
        ) : (
          <CardsSkeleton label={t('circles.join.loading')} />
        )
      ) : (
        <>
          <Card testID="join-card">
            <Text className="text-h2 text-ink">{preview.name}</Text>
            <FamiliesLine count={preview.families_count} area={preview.area.label} />
            <TypeLine visibility={preview.visibility} />
            {preview.admin ? (
              <View className="flex-row items-center gap-sm pt-xs">
                <Text className="text-caption text-ink-2">{t('circles.join.admin')}</Text>
                <Avatar
                  name={preview.admin.first_name}
                  seed={displayName(preview.admin)}
                  size="md"
                />
                <Text className="flex-1 text-body font-medium text-ink">
                  {displayName(preview.admin)}
                </Text>
                <VerifiedBadge verified={preview.admin.verified} testID="join-admin-badge" />
              </View>
            ) : null}
          </Card>
          {guest ? null : <Text className="text-body text-ink-2">{t('circles.join.note')}</Text>}
          <View className="gap-sm">{action}</View>
        </>
      )}
    </FormScreen>
  );
}
