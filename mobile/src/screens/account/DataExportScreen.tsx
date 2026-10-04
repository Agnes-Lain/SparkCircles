import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Text, View } from 'react-native';

import { account } from '../../api';
import { DATA_EXPORT_KEY } from '../../api/account';
import { ApiError } from '../../api/errors';
import type { DataExport } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { Skeleton } from '../../components/Skeleton';
import { currentLocale } from '../../i18n';
import { beforeFullStop, formatMomentDay, isoDateInDays } from '../../i18n/format';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { useSubmitOnce } from '../auth/useSubmitOnce';

/** The copy's file name, dated today in local time: `sparkcircles-data-2026-10-04.json`. */
export function dataFileName(today: Date = new Date()): string {
  return `sparkcircles-data-${isoDateInDays(0, today)}.json`;
}

/**
 * Writes the copy (downloaded with the Authorization header by the API client, never a token
 * in a URL) to a JSON file in the app cache, hands it to the system share sheet (save to
 * Files, send by email…), then deletes the cached file (M-2).
 */
export async function shareDataFile(data: unknown, dialogTitle?: string): Promise<void> {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const file = new File(Paths.cache, dataFileName());
  try {
    file.create({ overwrite: true });
    file.write(text);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle,
    });
  } finally {
    if (file.exists) file.delete();
  }
}

/**
 * A6 Copy of my data (AC-12.1–12.3): not requested, pending, ready (download, login
 * required: AC-12.2), link expired. Also the target of the "your data is ready" email
 * (`/my-data`).
 */
export function DataExportScreen() {
  const { t } = useTranslation();
  const back = useBack('/account');
  const queryClient = useQueryClient();
  const locale = currentLocale();

  const status = useQuery<{ data_export: DataExport | null }, ApiError>({
    queryKey: DATA_EXPORT_KEY,
    queryFn: ({ signal }) => account().dataExport(signal),
    retry: false,
    staleTime: 0,
  });

  const request = useMutation({
    mutationFn: () => account().requestDataExport(),
    onSuccess: (data) => queryClient.setQueryData(DATA_EXPORT_KEY, data),
  });
  const sendRequest = useSubmitOnce(request);

  const download = useMutation({
    mutationFn: async () =>
      shareDataFile(await account().downloadDataExport(), t('dataExport.download')),
    onError: (error) => {
      // Expired in the meantime: show the "Request a new copy" state.
      if (error instanceof ApiError && error.code === 'not_found') void status.refetch();
    },
  });
  const sendDownload = useSubmitOnce(download);

  const current = status.data?.data_export ?? null;
  const failed =
    (request.isError && request.error) ||
    (download.isError &&
    !(download.error instanceof ApiError && download.error.code === 'not_found')
      ? download.error
      : null);

  return (
    <FormScreen testID="data-export-screen">
      <Header title={t('dataExport.title')} onBack={back} />

      {status.isPending ? (
        <View
          accessible
          accessibilityLabel={t('common.oneMoment')}
          className="gap-sm"
          testID="data-loading"
        >
          <Skeleton width="95%" height={14} />
          <Skeleton width="85%" height={14} />
          <Skeleton width="60%" height={14} />
        </View>
      ) : status.isError ? (
        <UnreachableNotification
          onRetry={() => void status.refetch()}
          retrying={status.isFetching}
        />
      ) : (
        <>
          {failed ? (
            <UnreachableNotification
              onRetry={() => (request.isError ? sendRequest() : sendDownload())}
              retrying={request.isPending || download.isPending}
            />
          ) : null}

          {current?.status === 'pending' ? (
            <View className="items-start gap-sm" testID="data-pending">
              <Badge kind="badge-yellow" label={t('badge.pending')} />
              <Text className="text-body text-ink-2">
                {t('dataExport.requestedOn', {
                  date: beforeFullStop(formatMomentDay(current.requested_at, locale)),
                })}
              </Text>
              <View className="self-stretch">
                <Button size="large" label={t('dataExport.request')} disabled onPress={() => {}} />
              </View>
            </View>
          ) : current?.status === 'ready' ? (
            <View className="gap-xl" testID="data-ready">
              <Notification
                level="confirmed"
                title={t('dataExport.readyTitle')}
                caption={
                  current.expires_at
                    ? t('dataExport.readyCaption', {
                        date: beforeFullStop(formatMomentDay(current.expires_at, locale)),
                      })
                    : undefined
                }
              />
              <Button
                size="large"
                label={t('dataExport.download')}
                loading={download.isPending}
                onPress={() => sendDownload()}
                testID="download"
              />
            </View>
          ) : current?.status === 'expired' ? (
            <View className="gap-xl" testID="data-expired">
              <Text className="text-body text-ink-2">{t('dataExport.expired')}</Text>
              <Button
                size="large"
                label={t('dataExport.requestAgain')}
                loading={request.isPending}
                onPress={() => sendRequest()}
                testID="request"
              />
            </View>
          ) : (
            <View className="gap-xl" testID="data-none">
              <Text className="text-body text-ink-2">{t('dataExport.body')}</Text>
              <Button
                size="large"
                label={t('dataExport.request')}
                loading={request.isPending}
                onPress={() => sendRequest()}
                testID="request"
              />
            </View>
          )}
        </>
      )}
    </FormScreen>
  );
}
