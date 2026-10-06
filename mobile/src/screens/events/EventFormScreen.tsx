import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ChevronDown, CircleAlert, Lock, X } from 'lucide-react-native';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  Text,
  type TextInput,
  View,
} from 'react-native';

import { events } from '../../api';
import type { ApiError } from '../../api/errors';
import type { SparkEvent } from '../../api/events';
import { useMe } from '../../auth/useMe';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryPill';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { FormScreen } from '../auth/layouts';
import { useFocusFirstError } from '../auth/formErrors';
import { useBack } from '../auth/useBack';
import { fold } from './AreaSheet';
import { CATEGORIES, CATEGORY_ICON } from './categories';
import { ConfirmSheet } from './ConfirmSheet';
import { EventListSkeleton } from './EventCardSkeleton';
import { formatCalendarDay } from './format';
import {
  checkTag,
  EMPTY_FORM,
  type Field,
  FIELD_ORDER,
  type FormErrors,
  formFromEvent,
  type FormValues,
  LIMITS,
  notifiesParticipants,
  parseDay,
  parseTime,
  serverErrors,
  TAG_ERROR_KEY,
  toParams,
  validateForm,
} from './formModel';
import { storeEvent, useEvent, useEventOptions } from './queries';

type Sheet = null | 'category' | 'publish' | 'notify' | 'leave';
type Action = 'draft' | 'publish' | 'save';

/** Create (`/events/new`) and edit (`/events/:id/edit`): only verified parents host (AC-1.1). */
export function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useMe();
  const existing = useEvent(id ?? '');
  // Not verified: the "verify to host" gate (V0) replaces the form; nothing is created.
  if (me.data && !me.data.verification.verified) return <Redirect href="/verify" />;
  if (id && !existing.data) return <EditLoading error={existing.error} retry={existing.refetch} />;
  return <EventForm event={existing.data} key={existing.data?.id ?? 'new'} />;
}

function EditLoading({ error, retry }: { error: ApiError | null; retry: () => unknown }) {
  const { t } = useTranslation();
  const back = useBack('/');
  return (
    <FormScreen testID="event-form-loading">
      <Header title={t('events.form.editTitle')} onBack={back} />
      {error ? (
        <Notification
          level="error"
          title={t('errors.unreachable.title')}
          caption={t('errors.unreachable.caption')}
          action={
            <Button
              variant="secondary"
              size="small"
              label={t('errors.tryAgain')}
              onPress={() => void retry()}
            />
          }
          testID="event-form-error"
        />
      ) : (
        <EventListSkeleton />
      )}
    </FormScreen>
  );
}

function EventForm({ event }: { event?: SparkEvent }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const navigation = useNavigation();
  const back = useBack('/');
  const queryClient = useQueryClient();
  const { showToast, celebrate } = useToast();
  const options = useEventOptions();
  const published = Boolean(event && event.status !== 'draft');
  const placesTaken = event?.places.taken ?? 0;

  const initial = useMemo(() => (event ? formFromEvent(event) : EMPTY_FORM), [event]);
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagNotice, setTagNotice] = useState('');
  const [areaText, setAreaText] = useState(event?.area.label ?? '');
  const [areaFocused, setAreaFocused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [problem, setProblem] = useState<'verification' | 'offline' | 'rateLimited' | null>(null);
  const leaving = useRef<null | (() => void)>(null);
  const saved = useRef(false);

  const titleRef = useRef<TextInput>(null);
  const categoryRef = useRef<View>(null);
  const dateRef = useRef<TextInput>(null);
  const timeRef = useRef<TextInput>(null);
  const areaRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const placesRef = useRef<TextInput>(null);
  const joinRuleRef = useRef<View>(null);
  const descriptionRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const tagsRef = useRef<TextInput>(null);
  const focusFirstError = useFocusFirstError(FIELD_ORDER, {
    title: titleRef,
    category: categoryRef,
    date: dateRef,
    time: timeRef,
    area: areaRef,
    address: addressRef,
    places: placesRef,
    joinRule: joinRuleRef,
    description: descriptionRef,
    age: ageRef,
    tags: tagsRef,
  } satisfies Record<Field, RefObject<TextInput | View | null>>);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || tagInput.trim() !== '';
  const requiredValid = Object.keys(validateForm(values, t, { placesTaken })).length === 0;

  // Back with edits: "Leave without saving?" (design E5 "Unsaved changes").
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || saved.current) return;
      e.preventDefault();
      leaving.current = () => navigation.dispatch(e.data.action);
      setSheet('leave');
    });
    return unsubscribe;
  }, [navigation, dirty]);

  const showErrors = (next: FormErrors) => {
    setErrors(next);
    focusFirstError(next);
  };

  const mutation = useMutation<SparkEvent, ApiError, Action>({
    mutationFn: async (action) => {
      const params = toParams(values, { includeRule: !published });
      if (!event) return (await events().create(params, action === 'publish')).event;
      const updated = (await events().update(event.id, params)).event;
      if (action === 'publish') return (await events().publish(event.id)).event;
      return updated;
    },
    onSuccess: (saved_, action) => {
      saved.current = true;
      setSheet(null);
      storeEvent(queryClient, saved_);
      if (action === 'publish') {
        celebrate();
        showToast(t('events.detail.online'));
      } else if (action === 'draft') {
        showToast(t('events.detail.draftSaved'));
      } else {
        showToast(t('common.saved'));
      }
      if (event) back();
      else router.replace(`/events/${saved_.id}`);
    },
    onError: (error) => {
      setSheet(null);
      if (error.code === 'validation_failed') {
        showErrors(serverErrors(error.details, t, placesTaken));
      } else if (error.code === 'verification_required') {
        setProblem('verification');
      } else if (error.code === 'rate_limited') {
        setProblem('rateLimited');
      } else {
        setProblem('offline');
      }
    },
  });

  const submit = (action: Action) => {
    setProblem(null);
    if (action !== 'draft') {
      const found = validateForm(values, t, { placesTaken });
      if (Object.keys(found).length) {
        showErrors(found);
        return;
      }
    }
    setErrors({});
    if (action === 'publish') setSheet('publish');
    else if (action === 'save' && notifiesParticipants(initial, values)) setSheet('notify');
    else mutation.mutate(action);
  };

  // ---- Tags (AC-3.8): space, comma or Return creates the tag ----
  const commitTags = (texts: string[]) => {
    const next = [...values.tags];
    let error: string | null = null;
    let duplicate = false;
    for (const text of texts) {
      const check = checkTag(text);
      if (!check) continue;
      if ('error' in check) error = t(TAG_ERROR_KEY[check.error]);
      else if (next.includes(check.tag)) duplicate = true;
      else if (next.length < LIMITS.tags) next.push(check.tag);
    }
    setTagError(error);
    if (!error) setTagInput('');
    const notice = duplicate ? t('events.form.tagAlready') : '';
    setTagNotice(notice);
    if (notice && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(notice);
    if (next.length !== values.tags.length) set('tags', next);
  };
  const onTagText = (text: string) => {
    if (/[\s,]/.test(text)) {
      commitTags(text.split(/[\s,]+/).filter(Boolean));
      setTagInput('');
    } else {
      setTagInput(text);
      if (tagError) setTagError(null);
    }
  };

  const areaSuggestions =
    areaFocused && !values.area
      ? (options.data?.areas ?? [])
          .filter((a) => fold(a.label).includes(fold(areaText)))
          .slice(0, 6)
      : [];
  const day = parseDay(values.day, values.month, values.year);
  const areaLabel = options.data?.areas.find((a) => a.key === values.area)?.label ?? areaText;
  const tagsFull = values.tags.length >= LIMITS.tags;

  return (
    <FormScreen testID="event-form">
      <Header
        title={event ? t('events.form.editTitle') : t('events.form.createTitle')}
        onBack={back}
      />

      {problem === 'verification' ? (
        <Notification
          level="error"
          title={t('events.form.draftStaysTitle')}
          caption={t('events.form.draftStaysBody')}
          action={
            <Button
              variant="secondary"
              size="small"
              label={t('events.detail.verifyCta')}
              onPress={() => router.push('/verify')}
            />
          }
          testID="form-verification"
        />
      ) : problem ? (
        <Notification
          level="error"
          title={problem === 'rateLimited' ? t('rateLimited.title') : t('errors.unreachable.title')}
          caption={problem === 'rateLimited' ? t('rateLimited.wait') : undefined}
          testID="form-error"
        />
      ) : null}

      <TextField
        ref={titleRef}
        label={t('events.form.title')}
        placeholder={t('events.form.titlePlaceholder')}
        value={values.title}
        onChangeText={(v) => set('title', v)}
        maxLength={LIMITS.title}
        error={errors.title}
        testID="form-title"
      />

      <View className="gap-xs">
        <Text className="text-body text-ink-2">{t('events.form.category')}</Text>
        <Pressable
          ref={categoryRef}
          testID="form-category"
          accessibilityRole="button"
          accessibilityLabel={`${t('events.form.category')}, ${
            values.category
              ? t(`events.categories.${values.category}`)
              : t('events.form.categoryPlaceholder')
          }${errors.category ? `. ${errors.category}` : ''}${published ? `. ${t('events.form.readOnly')}` : ''}`}
          accessibilityState={{ disabled: published }}
          disabled={published}
          onPress={() => setSheet('category')}
          className={`flex-row items-center gap-sm rounded-md border-[1.5px] bg-surface px-3.5 ${
            errors.category ? 'border-error-dark' : 'border-ink-3'
          } ${published ? 'opacity-60' : ''}`}
          style={{ minHeight: MIN_TOUCH_TARGET }}
        >
          {values.category ? (
            <CategoryIcon category={values.category} icon={CATEGORY_ICON[values.category]} />
          ) : null}
          <Text className={`flex-1 text-body ${values.category ? 'text-ink' : 'text-ink-3'}`}>
            {values.category
              ? t(`events.categories.${values.category}`)
              : t('events.form.categoryPlaceholder')}
          </Text>
          {published ? null : <Icon icon={ChevronDown} size={18} color="ink-2" />}
        </Pressable>
        {errors.category ? <FieldError message={errors.category} /> : null}
        {published ? (
          <Text className="text-caption text-ink-3">{t('events.form.readOnly')}</Text>
        ) : null}
      </View>

      <View className="gap-xs">
        <Text className="text-body text-ink-2">{t('events.form.date')}</Text>
        <View
          role="group"
          accessibilityLabel={t('events.form.date')}
          className="flex-row gap-sm"
          testID="form-date"
        >
          <View className="flex-1">
            <TextField
              ref={dateRef}
              kind="birthDay"
              label={t('verify.review.day')}
              value={values.day}
              onChangeText={(v) => set('day', v)}
              error={errors.date}
              hideErrorText
              testID="form-day"
            />
          </View>
          <View className="flex-1">
            <TextField
              kind="birthMonth"
              label={t('verify.review.month')}
              value={values.month}
              onChangeText={(v) => set('month', v)}
              error={errors.date}
              hideErrorText
              testID="form-month"
            />
          </View>
          <View className="flex-[1.5]">
            <TextField
              kind="birthYear"
              label={t('verify.review.year')}
              value={values.year}
              onChangeText={(v) => set('year', v)}
              error={errors.date}
              hideErrorText
              testID="form-year"
            />
          </View>
        </View>
        {errors.date ? (
          <FieldError message={errors.date} />
        ) : day ? (
          <Text className="text-caption text-ink-3">{formatCalendarDay(day, locale)}</Text>
        ) : null}
      </View>

      <View className="gap-xs">
        <View className="flex-row gap-sm">
          <View className="flex-1">
            <TextField
              ref={timeRef}
              kind="time"
              label={t('events.form.start')}
              placeholder="15:00"
              value={values.start}
              onChangeText={(v) => set('start', v)}
              onBlur={() => {
                const parsed = parseTime(values.start);
                if (parsed) set('start', parsed);
              }}
              error={errors.time}
              hideErrorText
              testID="form-start"
            />
          </View>
          <View className="flex-1">
            <TextField
              kind="time"
              label={t('events.form.end')}
              placeholder="17:00"
              value={values.end}
              onChangeText={(v) => set('end', v)}
              onBlur={() => {
                const parsed = parseTime(values.end);
                if (parsed) set('end', parsed);
              }}
              error={errors.time}
              hideErrorText
              testID="form-end"
            />
          </View>
        </View>
        {errors.time ? <FieldError message={errors.time} /> : null}
      </View>

      <View className="gap-xs">
        <TextField
          ref={areaRef}
          label={t('events.form.area')}
          placeholder={t('events.form.areaPlaceholder')}
          value={values.area ? areaLabel : areaText}
          onChangeText={(text) => {
            setAreaText(text);
            if (values.area) set('area', null);
          }}
          onFocus={() => setAreaFocused(true)}
          onBlur={() => setTimeout(() => setAreaFocused(false), 200)}
          helper={t('events.form.areaHelper')}
          error={errors.area}
          testID="form-area"
          trailing={
            values.area ? (
              <IconButton
                icon={X}
                size={18}
                color="ink-2"
                accessibilityLabel={t('events.search.clear')}
                onPress={() => {
                  set('area', null);
                  setAreaText('');
                  setAreaFocused(true);
                }}
              />
            ) : undefined
          }
        />
        {areaSuggestions.length ? (
          <View className="rounded-md border-[0.5px] border-border-soft bg-surface px-md">
            {areaSuggestions.map((area) => (
              <Pressable
                key={area.key}
                testID={`area-suggestion-${area.key}`}
                accessibilityRole="button"
                accessibilityLabel={area.label}
                onPress={() => {
                  set('area', area.key);
                  setAreaText(area.label);
                  setAreaFocused(false);
                }}
                className="justify-center"
                style={{ minHeight: MIN_TOUCH_TARGET }}
              >
                <Text className="text-body text-ink">{area.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <TextField
        ref={addressRef}
        label={t('events.form.address')}
        placeholder={t('events.form.addressPlaceholder')}
        value={values.address}
        onChangeText={(v) => set('address', v)}
        leading={<Icon icon={Lock} size={18} color="ink-2" />}
        helper={t('events.form.addressHelper')}
        maxLength={LIMITS.address}
        error={errors.address}
        testID="form-address"
      />

      <TextField
        ref={placesRef}
        kind="number"
        label={t('events.form.places')}
        placeholder={t('events.form.placesPlaceholder')}
        value={values.places}
        onChangeText={(v) => set('places', v)}
        helper={t('events.form.placesHelper')}
        error={errors.places}
        testID="form-places"
      />

      <View className="gap-xs" ref={joinRuleRef}>
        <Text className="text-body text-ink-2">{t('events.form.joinRule')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('events.form.joinRule')}>
          <RadioRow
            label={t('events.form.anyone')}
            helper={t('events.form.anyoneHelp')}
            selected={values.joinRule === 'anyone'}
            disabled={published}
            onPress={() => set('joinRule', 'anyone')}
            testID="rule-anyone"
          />
          <RadioRow
            label={t('events.form.verifiedOnly')}
            helper={t('events.form.verifiedOnlyHelp')}
            selected={values.joinRule === 'verified_only'}
            disabled={published}
            onPress={() => set('joinRule', 'verified_only')}
            testID="rule-verified"
          />
        </View>
        {errors.joinRule ? <FieldError message={errors.joinRule} /> : null}
        <Text className="text-caption text-ink-3">
          {published ? t('events.form.readOnly') : t('events.form.joinRuleHelper')}
        </Text>
      </View>

      <View className="h-[0.5px] bg-border-soft" />

      <TextField
        ref={descriptionRef}
        label={t('events.form.optional', { label: t('events.form.description') })}
        placeholder={t('events.form.descriptionPlaceholder')}
        value={values.description}
        onChangeText={(v) => set('description', v)}
        multiline
        maxLength={LIMITS.description}
        error={errors.description}
        testID="form-description"
      />

      <View className="gap-xs">
        <Text className="text-body text-ink-2">
          {t('events.form.optional', { label: t('events.form.age') })}
        </Text>
        <View
          role="group"
          accessibilityLabel={t('events.form.age')}
          className="flex-row items-end gap-sm"
        >
          <View className="flex-1">
            <TextField
              ref={ageRef}
              kind="number"
              label={t('events.form.ageFrom')}
              value={values.ageMin}
              onChangeText={(v) => set('ageMin', v)}
              maxLength={2}
              error={errors.age}
              hideErrorText
              testID="form-age-min"
            />
          </View>
          <View className="flex-1">
            <TextField
              kind="number"
              label={t('events.form.ageTo')}
              value={values.ageMax}
              onChangeText={(v) => set('ageMax', v)}
              maxLength={2}
              error={errors.age}
              hideErrorText
              testID="form-age-max"
            />
          </View>
          <Text className="pb-3 text-body text-ink-2">{t('events.form.years')}</Text>
        </View>
        {errors.age ? <FieldError message={errors.age} /> : null}
      </View>

      <View className="gap-sm">
        <TextField
          ref={tagsRef}
          label={t('events.form.optional', { label: t('events.form.tags') })}
          placeholder={t('events.form.tagsPlaceholder')}
          value={tagInput}
          onChangeText={onTagText}
          onSubmitEditing={() => commitTags([tagInput])}
          returnKeyType="done"
          editable={!tagsFull}
          leading={<Text className="text-body text-ink-2">#</Text>}
          helper={tagsFull ? t('events.form.tagsMax') : t('events.form.tagsHelper')}
          error={tagError ?? errors.tags}
          testID="form-tags"
        />
        <Text accessibilityLiveRegion="polite" className="text-caption text-ink-3">
          {tagNotice}
        </Text>
        {values.tags.length ? (
          <View className="flex-row flex-wrap gap-sm">
            {values.tags.map((tag) => (
              <View
                key={tag}
                className="flex-row items-center rounded-pill bg-shell pl-md"
                style={{ minHeight: MIN_TOUCH_TARGET }}
              >
                <Text className="text-body text-ink-2">#{tag}</Text>
                <IconButton
                  icon={X}
                  size={16}
                  color="ink-2"
                  accessibilityLabel={t('events.form.removeTag', { tag })}
                  onPress={() =>
                    set(
                      'tags',
                      values.tags.filter((x) => x !== tag),
                    )
                  }
                  testID={`remove-tag-${tag}`}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View className="gap-sm">
        {published ? (
          <Button
            size="large"
            label={t('events.form.save')}
            loading={mutation.isPending}
            onPress={() => submit('save')}
            testID="form-save"
          />
        ) : (
          <>
            <Button
              size="large"
              label={t('events.form.publish')}
              disabled={!requiredValid}
              loading={mutation.isPending && mutation.variables === 'publish'}
              onPress={() => submit('publish')}
              accessibilityHint={requiredValid ? undefined : t('events.form.fillRequired')}
              testID="form-publish"
            />
            {!requiredValid ? (
              <Text className="text-center text-caption text-ink-3">
                {t('events.form.fillRequired')}
              </Text>
            ) : null}
            <Button
              variant="ghost"
              label={t('events.form.saveDraft')}
              loading={mutation.isPending && mutation.variables === 'draft'}
              onPress={() => submit('draft')}
              testID="form-draft"
            />
          </>
        )}
      </View>

      <BottomSheet
        visible={sheet === 'category'}
        onClose={() => setSheet(null)}
        testID="category-sheet"
      >
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t('events.form.category')}
        </Text>
        <ScrollView style={{ maxHeight: 420 }}>
          <View accessibilityRole="radiogroup">
            {CATEGORIES.map((key) => (
              <RadioRow
                key={key}
                label={t(`events.categories.${key}`)}
                helper={options.data?.categories.find((c) => c.key === key)?.help}
                selected={values.category === key}
                leading={<CategoryIcon category={key} icon={CATEGORY_ICON[key]} />}
                onPress={() => {
                  set('category', key);
                  setSheet(null);
                }}
                testID={`pick-${key}`}
              />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>

      <ConfirmSheet
        visible={sheet === 'publish'}
        onClose={() => setSheet(null)}
        title={t('events.form.publishTitle')}
        body={t('events.form.publishBody')}
        primary={{
          label: t('events.form.publishConfirm'),
          onPress: () => mutation.mutate('publish'),
          loading: mutation.isPending,
          testID: 'confirm-publish',
        }}
        secondary={{ label: t('events.form.keepEditing'), onPress: () => setSheet(null) }}
        testID="publish-sheet"
      >
        <View accessible className="gap-xs rounded-lg bg-shell p-md" testID="publish-summary">
          <Text className="text-body font-medium text-ink">{values.title.trim()}</Text>
          <Text className="text-caption text-ink-2">
            {[
              day ? formatCalendarDay(day, locale) : '',
              `${parseTime(values.start) ?? ''}–${parseTime(values.end) ?? ''}`,
              areaLabel,
            ].join(' · ')}
          </Text>
          <Text className="text-caption text-ink-2">
            {values.joinRule === 'anyone'
              ? t('events.form.summaryAnyone', { count: Number(values.places) || 0 })
              : t('events.form.summaryVerified', { count: Number(values.places) || 0 })}
          </Text>
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={sheet === 'notify'}
        onClose={() => setSheet(null)}
        title={t('events.form.notifyTitle')}
        body={t('events.form.notifyBody')}
        primary={{
          label: t('events.form.notifySave'),
          onPress: () => mutation.mutate('save'),
          loading: mutation.isPending,
          testID: 'confirm-notify',
        }}
        secondary={{ label: t('events.form.keepEditing'), onPress: () => setSheet(null) }}
        testID="notify-sheet"
      />

      <ConfirmSheet
        visible={sheet === 'leave'}
        onClose={() => setSheet(null)}
        title={t('events.form.leaveTitle')}
        primary={
          published
            ? { label: t('events.form.keepEditing'), onPress: () => setSheet(null) }
            : {
                label: t('events.form.saveDraft'),
                onPress: () => submit('draft'),
                loading: mutation.isPending,
                testID: 'leave-save-draft',
              }
        }
        secondary={{
          label: t('events.form.leaveConfirm'),
          onPress: () => {
            setSheet(null);
            saved.current = true;
            leaving.current?.();
          },
          testID: 'leave-without-saving',
        }}
        testID="leave-form-sheet"
      />
    </FormScreen>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <View accessible accessibilityLiveRegion="polite" className="flex-row items-center gap-xs">
      <Icon icon={CircleAlert} size={14} color="error-dark" />
      <Text className="flex-1 text-caption text-error-dark">{message}</Text>
    </View>
  );
}
