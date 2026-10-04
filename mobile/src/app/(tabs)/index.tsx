import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { api } from '../../api';
import { useMe } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { useToast } from '../../components/ToastProvider';
import { ApiHealthCheck } from '../../screens/dev/ApiHealthCheck';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const { takeCelebration } = useToast();
  // Email just confirmed: the success checkmark plays when Home comes into view (design P1, S3).
  const [celebrating, setCelebrating] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (takeCelebration()) setCelebrating(true);
    }, [takeCelebration]),
  );

  return (
    <PlaceholderScreen
      title={t('tabs.home')}
      headerRight={
        // "My account" entry (design A1, design system section 10): LG initials avatar, top
        // right. Today isn't built yet, so it sits on the Home placeholder.
        me.data ? (
          <Avatar
            name={me.data.first_name}
            seed={me.data.id}
            onPress={() => router.push('/account')}
            accessibilityLabel={t('account.title')}
            testID="account-entry"
          />
        ) : null
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
