import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Href, Redirect, useRouter } from 'expo-router';
import { Check, CircleAlert } from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Image, Text, type TextInput, View } from 'react-native';

import { verification } from '../../api';
import { ApiError } from '../../api/errors';
import type { FieldErrorKey, Me, Verification } from '../../api/types';
import {
  type DocumentType,
  VERIFICATION_KEY,
  type VerificationSubmission,
} from '../../api/verification';
import { ME_KEY } from '../../auth/useMe';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { FormScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { useSubmitOnce } from '../auth/useSubmitOnce';
import { type PhotoSlot, slotsFor, useVerificationFlow } from './flow';
import { PrivacyNote } from './PrivacyNote';

const ADULT_AGE = 18;

type DobError = 'dobBlank' | 'dobInvalid' | 'dobUnderage';

/**
 * The date of birth typed as day, month and year, as the API wants it (YYYY-MM-DD), or the
 * reason it can't be sent. 18+ is checked here for a quick answer; the API decides.
 */
export function parseDateOfBirth(
  day: string,
  month: string,
  year: string,
  today: Date = new Date(),
): { value: string } | { error: DobError } {
  if (!day.trim() && !month.trim() && !year.trim()) return { error: 'dobBlank' };
  if (
    !/^\d{1,2}$/.test(day.trim()) ||
    !/^\d{1,2}$/.test(month.trim()) ||
    !/^\d{4}$/.test(year.trim())
  ) {
    return { error: 'dobInvalid' };
  }
  const d = Number(day.trim());
  const m = Number(month.trim());
  const y = Number(year.trim());
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { error: 'dobInvalid' };
  }
  const adultOn = new Date(Date.UTC(y + ADULT_AGE, m - 1, d));
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (y < 1900 || date.getTime() > todayUtc) return { error: 'dobInvalid' };
  if (adultOn.getTime() > todayUtc) return { error: 'dobUnderage' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return { value: `${y}-${pad(m)}-${pad(d)}` };
}

const PHOTO_FIELDS: Record<string, PhotoSlot> = {
  document_front: 'front',
  document_back: 'back',
  selfie: 'selfie',
};

/** What a failed upload means for the screen (designed copy where the design has it). */
function uploadProblem(error: ApiError | null) {
  if (!error) return null;
  if (error.status === 429) return { kind: 'rateLimited' as const };
  if (error.status === 413) return { kind: 'photos' as const, slots: ['front', 'back', 'selfie'] };
  if (error.code === 'validation_failed') {
    const details: Record<string, FieldErrorKey[]> = error.details ?? {};
    const photoFields = Object.keys(details).filter((field) => PHOTO_FIELDS[field]);
    // AC-7.4: a document the server finds expired can't be retaken, only replaced.
    if (photoFields.some((field) => details[field]?.includes('expired'))) {
      return { kind: 'expired' as const };
    }
    if (photoFields.length > 0) {
      return { kind: 'photos' as const, slots: photoFields.map((field) => PHOTO_FIELDS[field]) };
    }
    if (details.date_of_birth) return { kind: 'dob' as const };
  }
  return { kind: 'failed' as const };
}

/**
 * V4 Date of birth and check (AC-7.3, 7.15): the date of birth, the photos with "Retake",
 * then "Send for review" (multipart, with the session token). Photos stay on the device when
 * sending fails, and are erased once the server has them (M-25).
 */
export function ReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/verify/selfie');
  const queryClient = useQueryClient();
  const flow = useVerificationFlow();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [dobError, setDobError] = useState<DobError | null>(null);
  const dayRef = useRef<TextInput>(null);

  const showStatus = (sent: boolean) => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(sent ? { pathname: '/verify/status', params: { sent: '1' } } : '/verify/status');
  };

  const mutation = useMutation<{ verification: Verification }, ApiError, VerificationSubmission>({
    mutationFn: (submission) => verification().submit(submission),
    onSuccess: ({ verification: sent }) => {
      queryClient.setQueryData<Me>(ME_KEY, (me) => (me ? { ...me, verification: sent } : me));
      queryClient.setQueryData(VERIFICATION_KEY, { verification: sent });
      flow.clear();
      showStatus(true);
    },
    onError: (error) => {
      // AC-7.5: one already pending (sent from another device): show it.
      if (error.code === 'verification_pending') {
        void queryClient.invalidateQueries({ queryKey: ME_KEY });
        void queryClient.invalidateQueries({ queryKey: VERIFICATION_KEY });
        showStatus(false);
      } else if (error.code === 'validation_failed' && error.details?.date_of_birth) {
        // The date we sent is a real past date, so the server's `invalid` means under 18
        // (contract §6, e.g. the phone's clock is ahead of the server's).
        const dobError = error.details.date_of_birth.includes('blank') ? 'dobBlank' : 'dobUnderage';
        setDobError(dobError);
        AccessibilityInfo.announceForAccessibility(t(`verify.review.${dobError}`));
      }
    },
  });
  const submit = useSubmitOnce(mutation);
  const problem =
    mutation.error?.code === 'verification_pending' ? null : uploadProblem(mutation.error);

  useEffect(() => {
    if (mutation.isPending) AccessibilityInfo.announceForAccessibility(t('verify.review.sending'));
  }, [mutation.isPending, t]);

  const { documentType, photos } = flow;
  if (!documentType) return <Redirect href="/verify/document" />;
  const slots = slotsFor(documentType);
  const missing = slots.find((slot) => !photos[slot]);
  if (missing && !mutation.isSuccess) {
    return (
      <Redirect
        href={
          missing === 'selfie'
            ? '/verify/selfie'
            : { pathname: '/verify/capture', params: { side: missing } }
        }
      />
    );
  }

  const send = () => {
    const parsed = parseDateOfBirth(day, month, year);
    if ('error' in parsed) {
      setDobError(parsed.error);
      dayRef.current?.focus();
      AccessibilityInfo.announceForAccessibility(t(`verify.review.${parsed.error}`));
      return;
    }
    setDobError(null);
    const { front, back: backSide, selfie } = photos;
    if (!front || !selfie) return;
    submit({ documentType, front, back: backSide, selfie, dateOfBirth: parsed.value });
  };

  const retake = (slot: PhotoSlot) => {
    mutation.reset();
    const href: Href =
      slot === 'selfie'
        ? { pathname: '/verify/selfie', params: { retake: '1' } }
        : { pathname: '/verify/capture', params: { side: slot, retake: '1' } };
    router.push(href);
  };

  const dobMessage = dobError ? t(`verify.review.${dobError}`) : null;
  const rejected = problem?.kind === 'photos' ? problem.slots : [];

  return (
    <FormScreen testID="verify-review">
      <Header
        small
        title={t('verify.review.title')}
        onBack={back}
        step={t('verify.step', { step: 4 })}
      />

      <View className="gap-xs">
        <Text className="text-body text-ink-2">{t('verify.review.dateOfBirth')}</Text>
        {/* QA-V3: the three fields form one "Date of birth" group for screen readers. */}
        <View
          role="group"
          accessibilityLabel={t('verify.review.dateOfBirth')}
          className="flex-row gap-sm"
          testID="dob-group"
        >
          <View className="flex-1">
            <TextField
              ref={dayRef}
              kind="birthDay"
              label={t('verify.review.day')}
              value={day}
              onChangeText={setDay}
              error={dobMessage}
              hideErrorText
              testID="dob-day"
            />
          </View>
          <View className="flex-1">
            <TextField
              kind="birthMonth"
              label={t('verify.review.month')}
              value={month}
              onChangeText={setMonth}
              error={dobMessage}
              hideErrorText
              testID="dob-month"
            />
          </View>
          <View className="flex-[1.5]">
            <TextField
              kind="birthYear"
              label={t('verify.review.year')}
              value={year}
              onChangeText={setYear}
              error={dobMessage}
              hideErrorText
              testID="dob-year"
            />
          </View>
        </View>
        {dobMessage ? <FieldError message={dobMessage} testID="dob-error" /> : null}
      </View>

      <View className="rounded-lg border-[0.5px] border-border-soft bg-surface px-lg">
        {slots.map((slot, index) => (
          <Fragment key={slot}>
            {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
            <PhotoRow
              label={photoLabel(slot, documentType, t)}
              uri={photos[slot]?.uri}
              rejected={rejected.includes(slot)}
              onRetake={() => retake(slot)}
              slot={slot}
            />
          </Fragment>
        ))}
      </View>

      <PrivacyNote />

      {problem?.kind === 'expired' ? (
        <View className="gap-sm">
          <FieldError message={t('verify.review.expired')} testID="document-expired" />
          <View className="items-start">
            <Button
              variant="ghost"
              label={t('verify.review.otherDocument')}
              onPress={() => router.dismissTo('/verify/document')}
              testID="other-document"
            />
          </View>
        </View>
      ) : problem?.kind === 'photos' ? (
        <Notification
          level="error"
          title={t('verify.review.failedTitle')}
          caption={t('verify.review.photosRejectedCaption')}
          testID="upload-error"
        />
      ) : problem?.kind === 'rateLimited' ? (
        <Notification
          level="error"
          title={t('rateLimited.title')}
          caption={t('rateLimited.wait')}
          testID="upload-error"
        />
      ) : problem?.kind === 'failed' ? (
        <Notification
          level="error"
          title={t('verify.review.failedTitle')}
          caption={t('verify.review.failedCaption')}
          testID="upload-error"
        />
      ) : null}

      <View className="gap-sm">
        <Button
          size="large"
          label={t('verify.review.send')}
          loading={mutation.isPending}
          onPress={send}
          testID="send-for-review"
        />
        {mutation.isPending ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-caption text-ink-3"
            testID="sending"
          >
            {t('verify.review.sending')}
          </Text>
        ) : null}
      </View>
    </FormScreen>
  );
}

function photoLabel(
  slot: PhotoSlot,
  type: DocumentType,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const document = t(`verify.document.short.${type}`);
  if (slot === 'selfie') return t('verify.review.selfie');
  if (type === 'passport') return t('verify.review.photoPage', { document });
  return t(slot === 'back' ? 'verify.review.back' : 'verify.review.front', { document });
}

function PhotoRow({
  label,
  uri,
  rejected,
  onRetake,
  slot,
}: {
  label: string;
  uri: string | undefined;
  rejected: boolean;
  onRetake: () => void;
  slot: PhotoSlot;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-xs py-sm" testID={`photo-row-${slot}`}>
      <View className="min-h-[52px] flex-row items-center gap-md">
        {uri ? (
          <Image
            source={{ uri }}
            accessible={false}
            className="h-11 w-11 rounded-sm bg-shell"
            resizeMode="cover"
          />
        ) : null}
        <View accessible className="flex-1 flex-row items-center gap-sm">
          <Text className="flex-1 text-body text-ink">{label}</Text>
          {rejected ? null : <Icon icon={Check} size={18} color="green-dark" />}
        </View>
        <Button
          variant="ghost"
          size="small"
          label={t('verify.review.retake')}
          accessibilityLabel={t('verify.review.retakeA11y', { photo: label })}
          onPress={onRetake}
          testID={`retake-${slot}`}
        />
      </View>
      {rejected ? <FieldError message={t('verify.review.photoRejected')} /> : null}
    </View>
  );
}

function FieldError({ message, testID }: { message: string; testID?: string }) {
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-xs"
      testID={testID}
    >
      <Icon icon={CircleAlert} size={14} color="error-dark" />
      <Text className="flex-1 text-caption text-error-dark">{message}</Text>
    </View>
  );
}
