import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { ApiClient } from '../../api/client';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { Skeleton } from '../../components/Skeleton';

/**
 * Development-only check that this phone reaches the Rails API (`GET /up`). Shown on the
 * Home placeholder while __DEV__ is true; removed when the Home screen is built.
 */
export function ApiHealthCheck({ client }: { client: () => Pick<ApiClient, 'health'> }) {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ['dev', 'health'],
    queryFn: ({ signal }) => client().health(signal),
    retry: false,
  });

  return (
    <View className="mt-xl" testID="api-health">
      <Text className="mb-sm text-label uppercase text-ink-2">{t('dev.label')}</Text>
      {health.isPending ? (
        <View accessibilityLabel={t('dev.apiChecking')} accessible>
          <Skeleton width="60%" height={16} />
        </View>
      ) : health.isError ? (
        <Notification
          level="error"
          title={t('errors.unreachable.title')}
          caption={t('errors.unreachable.caption')}
          action={
            <Button
              label={t('errors.tryAgain')}
              variant="secondary"
              size="small"
              loading={health.isFetching}
              onPress={() => void health.refetch()}
            />
          }
        />
      ) : (
        <View className="flex-row items-center">
          <Icon icon={Check} size={20} color="green-dark" />
          <Text className="ml-xs text-body text-ink">{t('dev.apiReachable')}</Text>
        </View>
      )}
    </View>
  );
}
