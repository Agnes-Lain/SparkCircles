import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { api } from '../../api';
import { useLogOut } from '../../auth/useLogOut';
import { Button } from '../../components/Button';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { useToast } from '../../components/ToastProvider';
import { ApiHealthCheck } from '../../screens/dev/ApiHealthCheck';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

export default function HomeScreen() {
  const { t } = useTranslation();
  const logOut = useLogOut();
  const { takeCelebration } = useToast();
  // Email just confirmed: the success checkmark plays when Home comes into view (design P1, S3).
  const [celebrating, setCelebrating] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (takeCelebration()) setCelebrating(true);
    }, [takeCelebration]),
  );

  return (
    <PlaceholderScreen title={t('tabs.home')}>
      {celebrating ? (
        <View className="mt-xl items-center">
          <SuccessCheckmark />
        </View>
      ) : null}
      {__DEV__ ? (
        <>
          <ApiHealthCheck client={api} />
          {/* Temporary, development only: "Log out" moves to My account in the next PR. */}
          <View className="mt-lg items-start">
            <Button
              variant="ghost"
              label={t('common.logOut')}
              onPress={() => void logOut()}
              testID="dev-log-out"
            />
          </View>
        </>
      ) : null}
    </PlaceholderScreen>
  );
}
