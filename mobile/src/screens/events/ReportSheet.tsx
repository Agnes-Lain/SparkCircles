import { useMutation } from '@tanstack/react-query';
import { Check, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { events } from '../../api';
import type { ApiError } from '../../api/errors';
import type { ReportReason } from '../../api/events';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { TextField } from '../../components/TextField';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { useEventOptions } from './queries';

const DETAILS_MAX = 500;

type Step = 'menu' | 'reasons' | 'received';

/**
 * E7 Report this event (AC-9.1, 9.2, 3.11): "⋯" opens the menu (tap 1), "Report this event"
 * (tap 2), a reason from the contract's list (tap 3), "Send the report" (tap 4). One sheet
 * whose content changes, so no sheet opens over another.
 */
export function ReportSheet({
  eventId,
  visible,
  onClose,
}: {
  eventId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const options = useEventOptions();
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const limit = options.data?.limits.report_details ?? DETAILS_MAX;

  // Mounted afresh on each opening (the detail changes its `key`).

  const mutation = useMutation<unknown, ApiError, void>({
    mutationFn: () => events().report(eventId, reason!, details.trim() || undefined),
    onSuccess: () => setStep('received'),
    // Already reported: the team already has it, so the answer is the same.
    onError: (error) => {
      if (error.code === 'already_reported') setStep('received');
    },
  });
  const failed = mutation.error && mutation.error.code !== 'already_reported';

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="report-sheet">
      {step === 'menu' ? (
        <View className="gap-md">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('events.report.menuTitle')}
          </Text>
          <Pressable
            testID="report-action"
            accessibilityRole="button"
            accessibilityLabel={t('events.report.action')}
            onPress={() => setStep('reasons')}
            className="flex-row items-center gap-md"
            style={{ minHeight: MIN_TOUCH_TARGET + 8 }}
          >
            <Icon icon={Flag} size={20} color="ink-2" />
            <Text className="text-body font-medium text-ink">{t('events.report.action')}</Text>
          </Pressable>
        </View>
      ) : step === 'received' ? (
        <View className="items-center gap-lg" testID="report-received">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-green-light">
            <Icon icon={Check} size={28} color="green-dark" />
          </View>
          <View className="gap-xs">
            <Text accessibilityRole="header" className="text-center text-h2 text-ink">
              {t('events.report.receivedTitle')}
            </Text>
            <Text className="text-center text-body text-ink-2">
              {t('events.report.receivedBody')}
            </Text>
          </View>
          <View className="self-stretch">
            <Button size="large" label={t('common.ok')} onPress={onClose} />
          </View>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
          <View className="gap-md">
            <View className="gap-xs">
              <Text accessibilityRole="header" className="text-h2 text-ink">
                {t('events.report.action')}
              </Text>
              <Text className="text-body text-ink-2">{t('events.report.body')}</Text>
            </View>
            {failed ? (
              <Notification
                level="error"
                title={
                  mutation.error?.code === 'rate_limited'
                    ? t('rateLimited.title')
                    : t('errors.unreachable.title')
                }
                caption={
                  mutation.error?.code === 'rate_limited'
                    ? t('rateLimited.wait')
                    : t('errors.unreachable.caption')
                }
                testID="report-error"
              />
            ) : null}
            <View accessibilityRole="radiogroup">
              {(options.data?.report_reasons ?? []).map((item) => (
                <RadioRow
                  key={item.key}
                  label={item.label}
                  selected={reason === item.key}
                  onPress={() => setReason(item.key)}
                  testID={`reason-${item.key}`}
                />
              ))}
            </View>
            <TextField
              label={t('events.report.details')}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={limit}
              helper={`${details.length}/${limit}`}
              testID="report-details"
            />
            <View className="gap-xs">
              <Button
                size="large"
                label={t('events.report.send')}
                disabled={!reason}
                loading={mutation.isPending}
                onPress={() => mutation.mutate()}
                testID="report-send"
              />
              {!reason ? (
                <Text className="text-center text-caption text-ink-3">
                  {t('events.report.chooseReason')}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}
