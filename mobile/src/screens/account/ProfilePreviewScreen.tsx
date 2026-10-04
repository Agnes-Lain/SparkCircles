import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Lock, MapPin } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { account } from '../../api';
import { PUBLIC_PROFILE_KEY } from '../../api/account';
import type { ApiError } from '../../api/errors';
import type { PublicProfile } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { SectionLabel } from '../../components/SettingsList';
import { Skeleton } from '../../components/Skeleton';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { BadgeSheet, PublicBadge } from './BadgeSheet';

/** A2 How others see me (AC-6.1, 6.3): the public profile exactly as the API serves it. */
export function ProfilePreviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/account');
  const [sheetOpen, setSheetOpen] = useState(false);
  const badgeRef = useRef<View>(null);
  const profile = useQuery<PublicProfile, ApiError>({
    queryKey: PUBLIC_PROFILE_KEY,
    queryFn: ({ signal }) => account().publicProfile(signal),
    retry: false,
  });

  return (
    <FormScreen testID="profile-preview-screen">
      <Header title={t('profilePreview.title')} onBack={back} intro={t('profilePreview.intro')} />

      {profile.data ? (
        <View
          accessibilityLabel={t('profilePreview.cardLabel')}
          className="flex-row items-center gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
          testID="public-profile"
        >
          <Avatar name={profile.data.first_name} seed={profile.data.id} />
          <View className="flex-1 gap-xs">
            <View className="flex-row flex-wrap items-center gap-sm">
              <Text className="text-h3 text-ink">
                {`${profile.data.first_name} ${profile.data.last_name_initial}.`}
              </Text>
              <PublicBadge
                ref={badgeRef}
                verified={profile.data.verified}
                onPress={() => setSheetOpen(true)}
              />
            </View>
            <View className="flex-row items-center gap-xs">
              <Icon icon={MapPin} size={14} color="ink-2" />
              <Text className="text-caption text-ink-2">
                {profile.data.city_shown || t('profilePreview.noCity')}
              </Text>
            </View>
          </View>
        </View>
      ) : profile.isError ? (
        <UnreachableNotification
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
      ) : (
        <View
          accessible
          accessibilityLabel={t('common.oneMoment')}
          className="flex-row items-center gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
          testID="profile-loading"
        >
          <Skeleton width={44} height={44} roundedClassName="rounded-full" />
          <View className="flex-1 gap-sm">
            <Skeleton width="50%" height={16} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      )}

      <View className="gap-sm">
        <SectionLabel>{t('profilePreview.neverShown')}</SectionLabel>
        <View className="flex-row items-start gap-sm">
          <Icon icon={Lock} color="ink-2" />
          <Text className="flex-1 text-body text-ink-2">{t('profilePreview.neverShownBody')}</Text>
        </View>
      </View>

      <Button
        size="large"
        label={t('profilePreview.edit')}
        onPress={() => router.push('/account/edit-profile')}
        testID="edit-profile"
      />

      <BadgeSheet
        verified={profile.data?.verified ?? false}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        returnFocusTo={badgeRef}
      />
    </FormScreen>
  );
}
