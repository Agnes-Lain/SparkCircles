import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { RefreshCw, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Text, View } from 'react-native';

import { circles } from '../../api';
import { type Invitation, invitationKey, isMemberCircle } from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { FormScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { ConfirmSheet } from '../events/ConfirmSheet';
import { Card, CardsSkeleton } from './CircleParts';
import { useCircle, useInvitation } from './queries';

/**
 * C3 Invite (AC-2.1, AC-2.2, AC-2.9, AC-2.10, design 3a to 3f): the link and the 8-character
 * code (Data display), the approval note, one primary "Partager l'invitation" (the phone's
 * share sheet, which also offers Copy), renew (with its consequences first) and turn off.
 */
export function InviteScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const back = useBack(`/circles/${id}`);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const query = useInvitation(id);
  const circle = useCircle(id).data;
  const name = circle && isMemberCircle(circle) ? circle.name : '';
  const [renewSheet, setRenewSheet] = useState(false);
  const invitation = query.data;

  const store = (next: { invitation: Invitation }) =>
    queryClient.setQueryData(invitationKey(id), next.invitation);
  const renew = useMutation<{ invitation: Invitation }, ApiError, void>({
    mutationFn: () => circles().renewInvitation(id),
    onSuccess: (next) => {
      setRenewSheet(false);
      store(next);
      showToast(t('circles.invite.renewed'));
    },
    onError: () => setRenewSheet(false),
  });
  const toggle = useMutation<{ invitation: Invitation }, ApiError, boolean>({
    mutationFn: (enabled) => circles().toggleInvitation(id, enabled),
    onSuccess: store,
    onError: () => showToast(t('circles.detail.actionError'), 'error'),
  });

  const share = () => {
    if (!invitation) return;
    void Share.share({
      message: t('circles.invite.shareMessage', {
        name,
        link: invitation.link,
        code: invitation.code,
      }),
    }).catch(() => undefined);
  };

  return (
    <FormScreen testID="invite-screen">
      <Header title={t('circles.invite.title')} onBack={back} intro={t('circles.invite.intro')} />
      {!invitation ? (
        query.isPending ? (
          <CardsSkeleton label={t('circles.invite.loading')} />
        ) : (
          <Notification
            level="error"
            title={t('circles.detail.loadError')}
            action={
              <Button
                variant="secondary"
                size="small"
                label={t('errors.tryAgain')}
                onPress={() => void query.refetch()}
              />
            }
          />
        )
      ) : !invitation.enabled ? (
        <>
          <Notification
            level="reminder"
            title={t('circles.invite.offTitle')}
            caption={t('circles.invite.offBody')}
            testID="invitation-off"
          />
          <Button
            size="large"
            label={t('circles.invite.turnOn')}
            loading={toggle.isPending}
            onPress={() => toggle.mutate(true)}
            testID="invitation-on"
          />
        </>
      ) : (
        <>
          {invitation.full ? (
            <Notification
              level="reminder"
              title={t('circles.invite.fullTitle')}
              caption={t('circles.invite.fullBody')}
              testID="invitation-full"
            />
          ) : null}
          {renew.error ? (
            <Notification
              level="error"
              title={t('circles.invite.renewError')}
              testID="renew-error"
            />
          ) : null}
          <Card>
            <Text className="text-label uppercase text-ink-2">{t('circles.invite.link')}</Text>
            <Text
              selectable
              className="text-body text-ink"
              numberOfLines={2}
              testID="invitation-link"
            >
              {invitation.link}
            </Text>
          </Card>
          <Card>
            <Text className="text-label uppercase text-ink-2">{t('circles.invite.code')}</Text>
            <Text
              selectable
              className="text-data text-ink"
              accessibilityLabel={invitation.code.split('').join(' ')}
              testID="invitation-code"
            >
              {invitation.code}
            </Text>
          </Card>
          {invitation.full ? null : (
            <Notification
              level="community"
              title={t('circles.invite.approvalTitle')}
              caption={t('circles.invite.approvalBody')}
            />
          )}
          <Button
            size="large"
            icon={Share2}
            label={t('circles.invite.share')}
            onPress={share}
            testID="invitation-share"
          />
          <Button
            variant="ghost"
            icon={RefreshCw}
            label={t('circles.invite.renew')}
            onPress={() => setRenewSheet(true)}
            testID="invitation-renew"
          />
          <View className="items-center">
            <TextLink
              quiet
              label={t('circles.invite.turnOff')}
              onPress={() => toggle.mutate(false)}
              disabled={toggle.isPending}
              testID="invitation-turn-off"
            />
          </View>
        </>
      )}
      <ConfirmSheet
        visible={renewSheet}
        onClose={() => setRenewSheet(false)}
        title={t('circles.invite.renewTitle')}
        body={t('circles.invite.renewBody')}
        primary={{
          label: t('circles.invite.renewConfirm'),
          onPress: () => renew.mutate(),
          loading: renew.isPending,
          testID: 'confirm-renew',
        }}
        secondary={{ label: t('circles.invite.renewKeep'), onPress: () => setRenewSheet(false) }}
        testID="renew-sheet"
      />
    </FormScreen>
  );
}
