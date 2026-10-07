import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { circles } from '../../api';
import {
  type CircleParams,
  type CircleVisibility,
  isMemberCircle,
  type MemberCircle,
} from '../../api/circles';
import type { ApiError } from '../../api/errors';
import type { FieldErrorKey } from '../../api/types';
import { useMe } from '../../auth/useMe';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { FormScreen, MessageScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { fold } from '../events/AreaSheet';
import { readArea } from '../events/areaStore';
import { ConfirmSheet } from '../events/ConfirmSheet';
import { useEventOptions } from '../events/queries';
import { CardsSkeleton } from './CircleParts';
import { ordinal, storeCircle, useCircle, useMyCircles } from './queries';

export const NAME_MIN = 3;
export const NAME_MAX = 50;
export const DESCRIPTION_MAX = 200;

type Values = {
  name: string;
  description: string;
  area: string | null;
  visibility: CircleVisibility;
};
type Errors = Partial<Record<'name' | 'description' | 'area', string>>;
type T = TFunction;

/** Client checks (the server checks again, AC-1.1, AC-1.3, AC-17.7). */
export function validateCircle(values: Values, t: T): Errors {
  const errors: Errors = {};
  const name = values.name.trim();
  if (name.length < NAME_MIN) errors.name = t('circles.form.errors.nameShort');
  else if (name.length > NAME_MAX) errors.name = t('circles.form.errors.nameLong');
  const over = values.description.trim().length - DESCRIPTION_MAX;
  if (over > 0) errors.description = t('circles.form.errors.descriptionLong', { count: over });
  if (!values.area) errors.area = t('circles.form.errors.area');
  return errors;
}

/** The API's field errors as the design's messages (design 11 "Server refusals"). */
export function circleServerErrors(
  details: Record<string, FieldErrorKey[]> | undefined,
  t: T,
): Errors {
  const errors: Errors = {};
  const message = (key: FieldErrorKey | undefined, field: 'name' | 'description') => {
    if (
      key === 'contains_phone' ||
      key === 'contains_email' ||
      key === 'contains_link' ||
      key === 'banned_word'
    )
      return t(`circles.form.errors.${key}`);
    if (field === 'name')
      return key === 'too_long'
        ? t('circles.form.errors.nameLong')
        : t('circles.form.errors.nameShort');
    return t('circles.form.errors.descriptionLong', { count: 1 });
  };
  if (details?.name) errors.name = message(details.name[0], 'name');
  if (details?.description) errors.description = message(details.description[0], 'description');
  if (details?.area) errors.area = t('circles.form.errors.area');
  return errors;
}

/** C2 Create a circle, and "Modifier le cercle" (`/circles/:id/edit`). */
export function CircleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? <EditCircle id={id} /> : <CreateCircle />;
}

function CreateCircle() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/community');
  const me = useMe();
  const mine = useMyCircles();
  const verified = me.data?.verification.verified ?? false;

  // 2e (AC-1.2): the backend refuses too; the screen says it first, with a way to start.
  if (me.data && !verified) {
    return (
      <MessageScreen
        testID="circle-create-unverified"
        onBack={back}
        icon={ShieldCheck}
        title={t('circles.form.verifyTitle')}
        body={t('circles.form.verifyBody')}
      >
        <Button
          size="large"
          label={t('circles.form.verifyCta')}
          onPress={() => router.push('/verify')}
        />
        <Button
          variant="ghost"
          label={t('circles.form.codeInstead')}
          onPress={() => router.replace('/circles/code')}
        />
      </MessageScreen>
    );
  }
  const limits = mine.data?.limits;
  // 2d (AC-1.4, AC-3.4): told why, no form.
  if (limits && (limits.created >= limits.max_created || limits.circles >= limits.max_circles)) {
    return <LimitScreen created={limits.created >= limits.max_created} onBack={back} />;
  }
  if (!limits) {
    return (
      <FormScreen>
        <Header title={t('circles.form.createTitle')} onBack={back} />
        <CardsSkeleton label={t('circles.loading')} />
      </FormScreen>
    );
  }
  return <CircleForm created={limits.created} />;
}

function LimitScreen({ created, onBack }: { created: boolean; onBack: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <MessageScreen
      testID="circle-create-limit"
      onBack={onBack}
      title={t('circles.form.limitTitle')}
      body={created ? t('circles.form.limitBody') : t('circles.form.memberLimitBody')}
    >
      <Button
        variant="ghost"
        label={t('circles.form.backToCircles')}
        onPress={() => router.replace('/community')}
      />
    </MessageScreen>
  );
}

function EditCircle({ id }: { id: string }) {
  const { t } = useTranslation();
  const back = useBack(`/circles/${id}`);
  const query = useCircle(id);
  const circle = query.data;
  if (circle && isMemberCircle(circle) && circle.can.edit) return <CircleForm circle={circle} />;
  return (
    <FormScreen>
      <Header title={t('circles.form.editTitle')} onBack={back} />
      {query.isPending ? (
        <CardsSkeleton label={t('circles.detail.loading')} />
      ) : (
        <Notification level="error" title={t('circles.detail.loadError')} />
      )}
    </FormScreen>
  );
}

function CircleForm({ circle, created = 0 }: { circle?: MemberCircle; created?: number }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const back = useBack(circle ? `/circles/${circle.id}` : '/community');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const me = useMe();
  const options = useEventOptions();
  const verified = me.data?.verification.verified ?? false;
  const [values, setValues] = useState<Values>({
    name: circle?.name ?? '',
    description: circle?.description ?? '',
    area: circle?.area.key ?? null,
    visibility: circle?.visibility ?? 'public',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [areaOpen, setAreaOpen] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Design question 4 (PM): the area is pre-filled from the profile (or the Sorties area).
  const areas = options.data?.areas;
  const prefilled = useRef(Boolean(circle));
  useEffect(() => {
    if (prefilled.current || !areas) return;
    prefilled.current = true;
    void readArea().then((stored) => {
      const city = fold(me.data?.city_shown ?? '');
      const fromProfile = areas.find((area) => city && fold(area.label) === city)?.key;
      const key = fromProfile ?? stored.areas.find((k) => areas.some((area) => area.key === k));
      if (key) setValues((v) => (v.area ? v : { ...v, area: key }));
    });
  }, [areas, me.data?.city_shown]);

  const mutation = useMutation<{ circle: MemberCircle }, ApiError, CircleParams>({
    mutationFn: (params) =>
      circle ? circles().update(circle.id, params) : circles().create(params),
    onSuccess: ({ circle: saved }) => {
      storeCircle(queryClient, saved);
      if (circle) {
        showToast(
          circle.visibility === 'public' && saved.visibility === 'private'
            ? t('circles.form.madePrivate')
            : t('circles.form.saved'),
        );
        back();
      } else {
        router.replace(`/circles/${saved.id}?created=1`);
      }
    },
    onError: (error) => {
      if (error.code === 'validation_failed') setErrors(circleServerErrors(error.details, t));
    },
  });

  const submit = (confirmed = false) => {
    const found = validateCircle(values, t);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (circle && circle.visibility === 'private' && values.visibility === 'public' && !confirmed) {
      setConfirmPublic(true);
      return;
    }
    setConfirmPublic(false);
    mutation.mutate({
      name: values.name.trim(),
      description: values.description.trim(),
      area: values.area ?? undefined,
      visibility: values.visibility,
    });
  };

  const failed = mutation.error && mutation.error.code !== 'validation_failed';
  const areaLabel = areas?.find((area) => area.key === values.area)?.label ?? circle?.area.label;
  const publicDisabled = !verified;
  const locked = mutation.isPending;

  return (
    <FormScreen testID="circle-form">
      <Header
        title={circle ? t('circles.form.editTitle') : t('circles.form.createTitle')}
        onBack={back}
      />

      <View className="gap-xs">
        <Text className="text-body text-ink-2">{t('circles.form.type')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('circles.form.type')}>
          <RadioRow
            label={t('circles.form.public')}
            helper={
              publicDisabled ? t('circles.form.publicUnavailable') : t('circles.form.publicHelp')
            }
            selected={values.visibility === 'public'}
            disabled={publicDisabled || locked}
            onPress={() => set('visibility', 'public')}
            testID="type-public-radio"
          />
          <RadioRow
            label={t('circles.form.private')}
            helper={t('circles.form.privateHelp')}
            selected={values.visibility === 'private'}
            disabled={locked}
            onPress={() => set('visibility', 'private')}
            testID="type-private-radio"
          />
          {/* PM approval note 2: neutral grey badge, no price, no paywall. */}
          <View className="items-start pb-sm">
            <Badge
              kind="badge-neutral"
              label={t('circles.form.freeTest')}
              testID="free-test-badge"
            />
          </View>
        </View>
      </View>

      {values.visibility === 'public' ? (
        <Notification
          level="reminder"
          title={t('circles.form.safetyTitle')}
          caption={t('circles.form.safetyBody')}
          testID="public-safety-note"
        />
      ) : (
        <Notification
          level="community"
          title={t('circles.form.privateTitle')}
          caption={t('circles.form.privateBody')}
          testID="private-note"
        />
      )}

      <TextField
        label={t('circles.form.name')}
        placeholder={t('circles.form.namePlaceholder')}
        value={values.name}
        onChangeText={(v) => set('name', v)}
        maxLength={NAME_MAX + 10}
        trailing={
          <Text className="text-caption text-ink-3">{`${values.name.trim().length}/${NAME_MAX}`}</Text>
        }
        helper={t('circles.form.nameHelper')}
        error={errors.name}
        editable={!locked}
        testID="circle-name"
      />
      <TextField
        label={t('circles.form.description')}
        value={values.description}
        onChangeText={(v) => set('description', v)}
        multiline
        helper={t('circles.form.descriptionHelper')}
        error={errors.description}
        editable={!locked}
        testID="circle-description"
      />
      <View className="gap-xs">
        <Text className="text-body text-ink-2">{t('circles.form.area')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('circles.form.area')}: ${areaLabel ?? t('circles.form.areaPlaceholder')}`}
          onPress={() => setAreaOpen(true)}
          disabled={locked}
          className={`flex-row items-center justify-between rounded-md border-[1.5px] bg-surface px-md ${
            errors.area ? 'border-error-dark' : 'border-ink-3'
          }`}
          style={{ minHeight: MIN_TOUCH_TARGET + 4 }}
          testID="circle-area"
        >
          <Text className={`text-body ${areaLabel ? 'text-ink' : 'text-ink-3'}`}>
            {areaLabel ?? t('circles.form.areaPlaceholder')}
          </Text>
          <Icon icon={ChevronDown} size={18} color="ink-2" />
        </Pressable>
        {errors.area ? <Text className="text-caption text-error-dark">{errors.area}</Text> : null}
        <Text className="text-caption text-ink-3">{t('circles.form.areaHelper')}</Text>
      </View>

      {failed ? (
        <Notification
          level="error"
          title={
            mutation.error?.code === 'rate_limited'
              ? t('rateLimited.title')
              : circle
                ? t('circles.form.errors.serverSave')
                : t('circles.form.errors.server')
          }
          caption={
            mutation.error?.isOffline ? t('errors.unreachable.caption') : mutation.error?.message
          }
          testID="circle-form-error"
        />
      ) : null}

      <View className="gap-xs">
        <Button
          size="large"
          label={circle ? t('circles.form.save') : t('circles.form.submit')}
          loading={mutation.isPending}
          onPress={() => submit()}
          testID="circle-submit"
        />
        {circle ? null : (
          <Text className="text-center text-caption text-ink-3">
            {t('circles.form.countCaption', { max: 3, ordinal: ordinal(created + 1, locale) })}
          </Text>
        )}
      </View>

      <BottomSheet visible={areaOpen} onClose={() => setAreaOpen(false)} testID="circle-area-sheet">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t('circles.form.chooseArea')}
        </Text>
        <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
          <View accessibilityRole="radiogroup">
            {(areas ?? []).map((area) => (
              <RadioRow
                key={area.key}
                label={area.label}
                selected={values.area === area.key}
                onPress={() => {
                  set('area', area.key);
                  setErrors((e) => ({ ...e, area: undefined }));
                  setAreaOpen(false);
                }}
                testID={`circle-area-${area.key}`}
              />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>

      <ConfirmSheet
        visible={confirmPublic}
        onClose={() => setConfirmPublic(false)}
        title={t('circles.form.publicSheet.title')}
        body={t('circles.form.publicSheet.intro')}
        primary={{
          label: t('circles.form.publicSheet.confirm'),
          onPress: () => submit(true),
          testID: 'confirm-public',
        }}
        secondary={{
          label: t('circles.form.publicSheet.keep'),
          onPress: () => {
            set('visibility', 'private');
            setConfirmPublic(false);
          },
        }}
        testID="public-sheet"
      >
        <View className="gap-sm">
          <Text className="text-body text-ink">{t('circles.form.publicSheet.visible')}</Text>
          <Text className="text-body text-ink-2">{t('circles.form.publicSheet.never')}</Text>
          <Notification
            level="reminder"
            title={t('circles.form.safetyTitle')}
            caption={t('circles.form.safetyBody')}
          />
        </View>
      </ConfirmSheet>
    </FormScreen>
  );
}
