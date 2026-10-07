import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { circles } from '../../api';
import { CIRCLE_REASONS, type CircleReportReason, MEMBER_REASONS } from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';

const DETAILS_MAX = 500;

/**
 * C5h Report a circle or a member (AC-7.1, AC-7.2, AC-7.4): a reason from the right list,
 * an optional comment, then "Merci, on regarde ça" and nothing more. Mounted afresh per
 * opening.
 */
export function CircleReportSheet({
  circleId,
  member,
  visible,
  onClose,
}: {
  circleId: string;
  /** A member report: their membership id and name. */
  member?: { id: string; name: string };
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [reason, setReason] = useState<CircleReportReason | null>(null);
  const [details, setDetails] = useState('');
  const mutation = useMutation<unknown, ApiError, void>({
    mutationFn: () => circles().report(circleId, reason!, details.trim() || undefined, member?.id),
    onSuccess: () => {
      onClose();
      showToast(t('circles.sheets.reported'));
    },
  });
  const reasons = member ? MEMBER_REASONS : CIRCLE_REASONS;

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="circle-report-sheet">
      <View className="gap-xs">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {member
            ? t('circles.sheets.reportMemberTitle', { name: member.name })
            : t('circles.sheets.reportTitle')}
        </Text>
        <Text className="text-body text-ink-2">{t('circles.sheets.reportBody')}</Text>
      </View>
      {mutation.error ? (
        <Notification
          level="error"
          title={
            mutation.error.code === 'rate_limited'
              ? t('rateLimited.title')
              : t('circles.detail.actionError')
          }
          testID="circle-report-error"
        />
      ) : null}
      <View accessibilityRole="radiogroup">
        {reasons.map((key) => (
          <RadioRow
            key={key}
            label={t(`circles.reasons.${key}`)}
            selected={reason === key}
            onPress={() => setReason(key)}
            testID={`circle-reason-${key}`}
          />
        ))}
      </View>
      <TextField
        label={t('circles.sheets.comment')}
        placeholder={t('circles.sheets.commentPlaceholder')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={DETAILS_MAX}
        helper={`${details.length}/${DETAILS_MAX}`}
        testID="circle-report-details"
      />
      <View className="gap-xs">
        <Button
          size="large"
          label={t('circles.sheets.send')}
          disabled={!reason}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          testID="circle-report-send"
        />
        {!reason ? (
          <Text className="text-center text-caption text-ink-3">
            {t('circles.sheets.chooseReason')}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
