import { useFocusEffect, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { api } from '../../api';
import { useIsGuest } from '../../auth/GateContext';
import { useMe } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '../../components/IconButton';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { useToast } from '../../components/ToastProvider';
import { ApiHealthCheck } from '../../screens/dev/ApiHealthCheck';
import { GuestTabScreen } from '../../screens/guest/GuestTabScreen';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

/**
 * My space (design system v1.7, sections 10 and 17): replaces Home; placeholder for now.
 * Guests get the explanation screen and the invitation to sign up (AC-15.5, AC-15.6).
 */
export default function MySpaceTab() {
  if (useIsGuest()) return <GuestTabScreen tab="mySpace" />;
  return <MySpaceScreen />;
}

function MySpaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const { takeCelebration } = useToast();
  // Email just confirmed: the success checkmark plays when My space comes into view (design P1, S3).
  const [celebrating, setCelebrating] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (takeCelebration()) setCelebrating(true);
    }, [takeCelebration]),
  );

  return (
    <PlaceholderScreen
      title={t('tabs.mySpace')}
      headerRight={
        // My space header (section 10, "My account" entry): the notifications bell, then the
        // LG initials avatar that opens My account.
        <View className="flex-row items-center gap-sm">
          {/* Placeholder: notifications aren't built yet (no unread dot, nothing to open). */}
          <IconButton
            icon={Bell}
            accessibilityLabel={t('mySpace.notifications')}
            onPress={() => undefined}
            testID="notifications-entry"
          />
          {me.data ? (
            <Avatar
              name={me.data.first_name}
              seed={me.data.id}
              onPress={() => router.push('/account')}
              accessibilityLabel={t('account.title')}
              testID="account-entry"
            />
          ) : null}
        </View>
      }
    >
      {celebrating ? (
        <View className="mt-xl items-center">
          <SuccessCheckmark />
        </View>
      ) : null}
      {__DEV__ ? <ApiHealthCheck client={api} /> : null}
    </PlaceholderScreen>
  );
}
