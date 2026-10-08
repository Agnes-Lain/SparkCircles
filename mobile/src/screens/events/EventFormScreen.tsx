import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ChevronDown, CircleAlert, Lock, Phone, X } from 'lucide-react-native';
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
import { EVENT_OPTIONS_KEY, type SparkEvent } from '../../api/events';
import { useMe } from '../../auth/useMe';
import { Checkbox } from '../../components/Checkbox';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryPill';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { SegmentedControl } from '../../components/SegmentedControl';
import { DateTimeField } from '../../components/DateTimeField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { FormScreen } from '../auth/layouts';
import { useFocusFirstError } from '../auth/formErrors';
import { useBack } from '../auth/useBack';
import { useMyCircles } from '../circles/queries';
import { fold } from './AreaSheet';
import { CATEGORIES, CATEGORY_ICON } from './categories';
import { ConfirmSheet } from './ConfirmSheet';
import { DropoffNotice } from './dropoff';
import { EventListSkeleton } from './EventCardSkeleton';
import { formatCalendarDay } from './format';
import {
  checkTag,
  DROPOFF_FIELD_ORDER,
  emptyForm,
  type Field,
  FIELD_ORDER,
  type FormErrors,
  formFromEvent,
  type FormValues,
  LIMITS,
  dropoffAllowed,
  localClock,
  localDay,
  missingFields,
  notifiesParticipants,
  pickerValue,
  serverErrors,
  startChanged,
  TAG_ERROR_KEY,
  toParams,
  validateForm,
  withAdultRequired,
  withDropoffSwitch,
} from './formModel';
import { hasEnded } from './presenters';
import { freshEvent, storeEvent, useEvent, useEventOptions } from './queries';
import { type ClosedReason, closedReason, isRefusal, refusalText } from './refusals';

type Sheet = null | 'category' | 'publish' | 'notify' | 'leave' | 'phone';
type Action = 'draft' | 'publish' | 'save';

/** BUG-4: only the host edits, and only a draft or a published event that hasn't ended
 *  (the API's `Event#editable?`). */
export function canEdit(event: SparkEvent): boolean {
  if (event.viewer.role !== 'host') return false;
  return event.status === 'draft' || (event.status === 'published' && !hasEnded(event));
}

/** Create (`/events/new`) and edit (`/events/:id/edit`): only verified parents host (AC-1.1). */
export function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useMe();
  const existing = useEvent(id ?? '');
  const closed =
    Boolean(id) &&
    ((existing.data && !canEdit(existing.data)) ||
      existing.error?.code === 'not_found' ||
      existing.error?.code === 'forbidden');
  // Not verified: the "verify to host" gate (V0) replaces the form; nothing is created.
  if (me.data && !me.data.verification.verified) return <Redirect href="/verify" />;
  if (closed) return <NotEditable id={id!} />;
  if (id && !existing.data) return <EditLoading error={existing.error} retry={existing.refetch} />;
  return <EventForm event={existing.data} key={existing.data?.id ?? 'new'} />;
}

/** BUG-4: someone else's event, or one that can't be edited any more: back to its page. */
function NotEditable({ id }: { id: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  useEffect(() => {
    showToast(t('events.form.notEditable'));
  }, [showToast, t]);
  return <Redirect href={`/events/${id}`} />;
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
  const pickerLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const [now] = useState(() => new Date());
  // `?check=1`: a publish from the draft's page was refused for missing fields (BUG-8).
  const { check, circle: circleParam } = useLocalSearchParams<{
    check?: string;
    circle?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const back = useBack('/');
  const queryClient = useQueryClient();
  const { showToast, celebrate } = useToast();
  const options = useEventOptions();
  const published = Boolean(event && event.status !== 'draft');
  const placesTaken = event?.places.taken ?? 0;

  // AC-16.1: a new event's language starts as the app language.
  const [appLanguage] = useState(locale);
  // Circles P7: "Proposer une sortie" from a circle opens the form with that circle ticked.
  const initial = useMemo(
    () =>
      event
        ? formFromEvent(event)
        : circleParam
          ? { ...emptyForm(appLanguage), visibility: 'circles' as const, circleIds: [circleParam] }
          : emptyForm(appLanguage),
    [event, appLanguage, circleParam],
  );
  // Circles AC-16.1, AC-16.8: the host's circles (none: the option isn't shown).
  const myCircles = useMyCircles();
  const hostCircles = (myCircles.data?.items ?? []).flatMap((item) =>
    item.state === 'member' ? [item.circle] : [],
  );
  const [formValues, setValues] = useState<FormValues>(initial);
  // Web beta Q2: drop-off switched off on the server, every event needs an adult.
  const offerDropoff = dropoffAllowed(options.data?.dropoff_enabled, event);
  const values = withDropoffSwitch(formValues, offerDropoff);
  // `?check=1`: opened from a refused publish, the missing fields show at once (BUG-8).
  const [errors, setErrors] = useState<FormErrors>(() =>
    check ? validateForm(initial, t, { placesTaken }) : {},
  );
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagNotice, setTagNotice] = useState('');
  const [areaText, setAreaText] = useState(event?.area?.label ?? '');
  const [areaFocused, setAreaFocused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [problem, setProblem] = useState<
    'verification' | 'offline' | 'rateLimited' | 'dropoffDisabled' | ClosedReason | null
  >(null);
  const leaving = useRef<null | (() => void)>(null);
  const saved = useRef(false);

  const titleRef = useRef<TextInput>(null);
  const categoryRef = useRef<View>(null);
  const dateRef = useRef<View>(null);
  const timeRef = useRef<View>(null);
  const areaRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const placesRef = useRef<TextInput>(null);
  const joinRuleRef = useRef<View>(null);
  const circlesRef = useRef<View>(null);
  const descriptionRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const tagsRef = useRef<TextInput>(null);
  const dropoff = !values.adultRequired;
  const focusFirstError = useFocusFirstError(dropoff ? DROPOFF_FIELD_ORDER : FIELD_ORDER, {
    title: titleRef,
    category: categoryRef,
    date: dateRef,
    time: timeRef,
    area: areaRef,
    address: addressRef,
    places: placesRef,
    circles: circlesRef,
    joinRule: joinRuleRef,
    description: descriptionRef,
    age: ageRef,
    phone: phoneRef,
    tags: tagsRef,
  } satisfies Record<Field, RefObject<TextInput | View | null>>);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || tagInput.trim() !== '';
  // BUG-7: a started event can still be fixed; its start is checked only if it changes.
  const checkStart = !published || startChanged(initial, values);
  const validate = () => validateForm(values, t, { placesTaken, checkStart });
  const requiredValid = Object.keys(validate()).length === 0;
  const missing = missingFields(values);
  const fieldLabel: Record<string, string> = {
    title: t('events.form.title'),
    category: t('events.form.category'),
    date: t('events.form.date'),
    time: `${t('events.form.start')}, ${t('events.form.end')}`,
    area: t('events.form.area'),
    address: t('events.form.address'),
    places: t('events.form.places'),
    age: t('events.dropoff.ageRequired'),
    phone: t('events.dropoff.phoneLabel'),
    circles: t('circles.eventForm.whichCircles'),
  };

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

  useEffect(() => {
    if (check) focusFirstError(errors);
    // Once, on opening from a refused publish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const newTags = values.tags.filter((tag) => !initial.tags.includes(tag));
      if (error.code === 'validation_failed') {
        showErrors(serverErrors(error.details, t, placesTaken, newTags));
      } else if (error.code === 'verification_required') {
        setProblem('verification');
      } else if (error.code === 'rate_limited') {
        setProblem('rateLimited');
      } else if (error.code === 'dropoff_disabled') {
        // Web beta Q2: switched off meanwhile; the options hide the setting once refreshed.
        void queryClient.invalidateQueries({ queryKey: EVENT_OPTIONS_KEY });
        setProblem('dropoffDisabled');
      } else if (isRefusal(error) && event) {
        // BUG-3: the event changed meanwhile (on hold, cancelled, ended, gone): say why.
        void freshEvent(queryClient, event.id).then((fresh) =>
          setProblem(closedReason(fresh, { editing: true })),
        );
      } else {
        setProblem('offline');
      }
    },
  });

  const submit = (action: Action) => {
    setProblem(null);
    if (action !== 'draft') {
      const found = validate();
      if (Object.keys(found).length) {
        showErrors(found);
        return;
      }
    }
    setErrors({});
    if (action === 'publish') setSheet('publish');
    // Design 3.1: a new phone on a published drop-off event is confirmed first.
    else if (action === 'save' && dropoff && values.hostPhone.trim() !== initial.hostPhone.trim())
      setSheet('phone');
    else saveOrNotify(action);
  };
  const saveOrNotify = (action: Action) => {
    if (action === 'save' && notifiesParticipants(initial, values)) setSheet('notify');
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
  const day = values.date;
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
      ) : problem === 'rateLimited' || problem === 'offline' ? (
        <Notification
          level="error"
          title={problem === 'rateLimited' ? t('rateLimited.title') : t('errors.unreachable.title')}
          caption={problem === 'rateLimited' ? t('rateLimited.wait') : t('events.form.keptCaption')}
          testID="form-error"
        />
      ) : problem === 'dropoffDisabled' ? (
        <Notification
          level="error"
          title={t('events.dropoff.disabledTitle')}
          caption={t('events.dropoff.disabledBody')}
          testID="form-dropoff-disabled"
        />
      ) : problem ? (
        <Notification level="error" {...refusalText(problem, t, true)} testID="form-refused" />
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

      <DateTimeField
        ref={dateRef}
        mode="date"
        label={t('events.form.date')}
        display={values.date ? formatCalendarDay(values.date, locale) : ''}
        placeholder={t('events.form.datePlaceholder')}
        value={pickerValue(values.date, null, now)}
        minimumDate={now}
        locale={pickerLocale}
        onChange={(moment) => set('date', localDay(moment))}
        error={errors.date}
        testID="form-date"
      />

      <View className="gap-xs">
        <View className="flex-row gap-sm">
          <View className="flex-1">
            <DateTimeField
              ref={timeRef}
              mode="time"
              label={t('events.form.start')}
              display={values.start ?? ''}
              placeholder={t('events.form.timePlaceholder')}
              value={pickerValue(values.date, values.start ?? '15:00', now)}
              locale={pickerLocale}
              onChange={(moment) => set('start', localClock(moment))}
              error={errors.time}
              hideErrorText
              testID="form-start"
            />
          </View>
          <View className="flex-1">
            <DateTimeField
              mode="time"
              label={t('events.form.end')}
              display={values.end ?? ''}
              placeholder={t('events.form.timePlaceholder')}
              value={pickerValue(values.date, values.end ?? values.start ?? '17:00', now)}
              locale={pickerLocale}
              onChange={(moment) => set('end', localClock(moment))}
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

      {/* Circles AC-16.1, AC-16.2, AC-16.8, AC-16.9: who can see the outing. */}
      <WhoCanSee
        values={values}
        published={published}
        circles={hostCircles}
        loading={myCircles.isPending}
        failed={Boolean(myCircles.error) && !myCircles.data}
        retry={() => void myCircles.refetch()}
        error={errors.circles}
        refView={circlesRef}
        onVisibility={(visibility) =>
          setValues((v) => ({
            ...v,
            visibility,
            // P7: a single circle is pre-ticked.
            circleIds:
              visibility === 'circles' && v.circleIds.length === 0 && hostCircles.length === 1
                ? [hostCircles[0]!.id]
                : v.circleIds,
          }))
        }
        onToggle={(id) =>
          setValues((v) => ({
            ...v,
            circleIds: v.circleIds.includes(id)
              ? v.circleIds.filter((k) => k !== id)
              : [...v.circleIds, id],
          }))
        }
        onCreateCircle={() => router.push('/circles/new')}
      />

      {/* AC-17.1: accompanying adult, two choices; drop-off follows from "Facultatif".
          Web beta Q2: not offered while drop-off is switched off. */}
      {offerDropoff ? (
        <SettingField
          label={t('events.dropoff.adultLabel')}
          published={published}
          value={values.adultRequired ? 'required' : 'optional'}
          segments={[
            { key: 'required', label: t('events.dropoff.adultRequired') },
            { key: 'optional', label: t('events.dropoff.adultOptional') },
          ]}
          onChange={(key) => setValues((v) => withAdultRequired(v, key === 'required'))}
          helper={t('events.dropoff.fixedHelper')}
          testIDPrefix="adult"
        />
      ) : null}

      {dropoff ? (
        <>
          <DropoffNotice
            title={t('events.dropoff.noticeTitle')}
            body={t('events.dropoff.noticeBody')}
            testID="form-dropoff-notice"
          />
          {/* AC-17.3: not a control; read as text, "locked" said in the text itself. */}
          <View className="gap-xs" ref={joinRuleRef}>
            <Text className="text-body text-ink-2">{t('events.form.joinRule')}</Text>
            <View
              accessible
              className="flex-row items-start gap-md rounded-md bg-shell p-md"
              testID="form-locked-rule"
            >
              <Icon icon={Lock} size={18} color="ink-2" />
              <View className="flex-1 gap-xs">
                <Text className="text-body font-medium text-ink">
                  {t('events.dropoff.lockedRule')}
                </Text>
                <Text className="text-caption text-ink-2">
                  {t('events.dropoff.lockedRuleBody')}
                </Text>
              </View>
            </View>
          </View>
          <AgeRange
            label={t('events.dropoff.ageRequired')}
            values={values}
            set={set}
            error={errors.age}
            inputRef={ageRef}
          />
          <TextField
            ref={phoneRef}
            kind="phone"
            label={t('events.dropoff.phoneLabel')}
            value={values.hostPhone}
            onChangeText={(v) => set('hostPhone', v)}
            leading={<Icon icon={Phone} size={18} color="ink-2" />}
            helper={t('events.dropoff.phoneNote')}
            error={errors.phone}
            testID="form-host-phone"
          />
        </>
      ) : values.visibility === 'circles' ? (
        // Circles AC-16.1: "Tous les membres de ces cercles", fixed (no "anyone", no verified-only).
        <View className="gap-xs" ref={joinRuleRef}>
          <Text className="text-body text-ink-2">{t('events.form.joinRule')}</Text>
          <View
            accessible
            className="flex-row items-start gap-md rounded-md bg-shell p-md"
            testID="form-circle-rule"
          >
            <Icon icon={Lock} size={18} color="ink-2" />
            <View className="flex-1 gap-xs">
              <Text className="text-body font-medium text-ink">
                {t('circles.eventForm.joinFixed')}
              </Text>
              <Text className="text-caption text-ink-2">
                {t('circles.eventForm.joinFixedHelp')}
              </Text>
            </View>
          </View>
        </View>
      ) : (
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
      )}

      {/* AC-17.13: participation validation, preset to "Je valide chaque demande" for drop-off. */}
      <SettingField
        label={t('events.dropoff.approvalLabel')}
        published={published}
        value={values.approvalRequired ? 'manual' : 'auto'}
        segments={[
          { key: 'auto', label: t('events.dropoff.approvalAuto') },
          { key: 'manual', label: t('events.dropoff.approvalManual') },
        ]}
        onChange={(key) =>
          setValues((v) => ({ ...v, approvalRequired: key === 'manual', approvalChosen: true }))
        }
        helper={
          dropoff ? t('events.dropoff.approvalHelperDropoff') : t('events.dropoff.fixedHelper')
        }
        testIDPrefix="approval"
      />

      {/* AC-16.1: the event's language, one choice; never translated (AC-16.4). */}
      <View className="gap-xs" testID="form-language">
        <Text className="text-body text-ink-2">{t('events.language.field')}</Text>
        <SegmentedControl
          accessibilityLabel={t('events.language.field')}
          segments={[
            { key: 'fr', label: t('events.language.fr') },
            { key: 'en', label: t('events.language.en') },
          ]}
          value={values.language}
          onChange={(language) => set('language', language)}
          testIDPrefix="language"
        />
        <Text className="text-caption text-ink-3">{t('events.language.helper')}</Text>
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

      {dropoff ? null : (
        <AgeRange
          label={t('events.form.optional', { label: t('events.form.age') })}
          values={values}
          set={set}
          error={errors.age}
          inputRef={ageRef}
        />
      )}

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
              <Text className="text-center text-caption text-ink-3" testID="form-missing">
                {t('events.form.fillRequired')}
                {missing.length
                  ? ` ${t('events.form.missing', {
                      fields: missing.map((field) => fieldLabel[field]).join(', '),
                    })}`
                  : ''}
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
        body={
          values.visibility === 'circles'
            ? t('circles.eventForm.publishBody')
            : t('events.dropoff.publishBody')
        }
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
              `${values.start ?? ''}–${values.end ?? ''}`,
              areaLabel,
            ].join(' · ')}
          </Text>
          {values.visibility === 'circles'
            ? hostCircles
                .filter((circle) => values.circleIds.includes(circle.id))
                .map((circle) => (
                  <Text key={circle.id} className="text-caption font-medium text-sky-dark">
                    {t('circles.event.badge', { name: circle.name })}
                  </Text>
                ))
            : null}
          <Text className="text-caption text-ink-2">
            {values.joinRule === 'anyone' && !dropoff
              ? t('events.form.summaryAnyone', { count: Number(values.places) || 0 })
              : t('events.form.summaryVerified', { count: Number(values.places) || 0 })}
          </Text>
          {offerDropoff ? (
            <SummaryRow
              label={t('events.dropoff.summaryAdult')}
              value={
                dropoff ? t('events.dropoff.adultOptional') : t('events.dropoff.adultRequired')
              }
            />
          ) : null}
          <SummaryRow
            label={t('events.dropoff.summaryRule')}
            value={
              values.visibility === 'circles' && !dropoff
                ? t('circles.eventForm.joinFixed')
                : values.joinRule === 'anyone' && !dropoff
                  ? t('events.form.anyone')
                  : t('events.form.verifiedOnly')
            }
          />
          <SummaryRow
            label={t('events.dropoff.summaryValidation')}
            value={
              values.approvalRequired
                ? t('events.dropoff.approvalManual')
                : t('events.dropoff.approvalAuto')
            }
          />
          {dropoff ? (
            <SummaryRow
              label={t('events.dropoff.summaryPhone')}
              value={t('events.dropoff.summaryPhoneValue')}
            />
          ) : null}
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={sheet === 'phone'}
        onClose={() => setSheet(null)}
        title={t('events.dropoff.phoneChanged')}
        primary={{
          label: t('events.form.save'),
          onPress: () => {
            setSheet(null);
            saveOrNotify('save');
          },
          loading: mutation.isPending,
          testID: 'confirm-phone',
        }}
        secondary={{ label: t('events.form.keepEditing'), onPress: () => setSheet(null) }}
        testID="phone-sheet"
      />

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

/**
 * Circles design 6a to 6c: "Qui peut voir la sortie ?" (all members / my circles), the
 * circles to tick, read-only once published (AC-16.9). A host without circle gets the
 * "Créer un cercle" invitation instead (AC-16.8); circles that fail to load say so.
 */
function WhoCanSee({
  values,
  published,
  circles,
  loading,
  failed,
  retry,
  error,
  refView,
  onVisibility,
  onToggle,
  onCreateCircle,
}: {
  values: FormValues;
  published: boolean;
  circles: { id: string; name: string; families_count: number }[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
  error?: string;
  refView: RefObject<View | null>;
  onVisibility: (visibility: FormValues['visibility']) => void;
  onToggle: (id: string) => void;
  onCreateCircle: () => void;
}) {
  const { t } = useTranslation();
  if (loading && values.visibility !== 'circles') return null;
  if (failed) {
    return (
      <View className="flex-row flex-wrap items-center gap-xs" testID="form-circles-failed">
        <Text className="text-caption text-ink-2">{t('circles.eventForm.circlesFailed')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={{ minHeight: MIN_TOUCH_TARGET }}
          className="justify-center"
        >
          <Text className="text-caption font-medium text-ink underline">
            {t('circles.eventForm.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (circles.length === 0 && values.visibility !== 'circles') {
    return (
      <View className="gap-xs rounded-md bg-sky-light p-md" testID="form-no-circle">
        <Text className="text-body font-medium text-ink">
          {t('circles.eventForm.noCircleTitle')}
        </Text>
        <Text className="text-caption text-sky-dark">{t('circles.eventForm.noCircleBody')}</Text>
        <View className="items-start">
          <Button
            variant="ghost"
            size="small"
            label={t('circles.create')}
            onPress={onCreateCircle}
          />
        </View>
      </View>
    );
  }
  return (
    <View className="gap-xs" ref={refView} testID="form-who-sees">
      <Text className="text-body text-ink-2">{t('circles.eventForm.whoSees')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('circles.eventForm.whoSees')}>
        <RadioRow
          label={t('circles.eventForm.everyone')}
          helper={t('circles.eventForm.everyoneHelp')}
          selected={values.visibility === 'searchable'}
          disabled={published}
          onPress={() => onVisibility('searchable')}
          testID="visibility-everyone"
        />
        <RadioRow
          label={t('circles.eventForm.myCircles')}
          helper={t('circles.eventForm.myCirclesHelp')}
          selected={values.visibility === 'circles'}
          disabled={published}
          onPress={() => onVisibility('circles')}
          testID="visibility-circles"
        />
      </View>
      {values.visibility === 'circles' ? (
        <View className="gap-xs rounded-lg border-[0.5px] border-border-soft bg-surface px-md">
          <Text className="pt-sm text-caption text-ink-2">
            {t('circles.eventForm.whichCircles')}
          </Text>
          {circles.map((circle) => (
            <Checkbox
              key={circle.id}
              label={`${circle.name} · ${t('circles.families', { count: circle.families_count })}`}
              accessibilityLabel={circle.name}
              checked={values.circleIds.includes(circle.id)}
              onChange={() => !published && onToggle(circle.id)}
              testID={`form-circle-${circle.id}`}
            />
          ))}
        </View>
      ) : null}
      {error ? <FieldError message={error} /> : null}
      <Text className="text-caption text-ink-3">
        {published ? t('events.form.readOnly') : t('circles.eventForm.fixedAfterPublish')}
      </Text>
    </View>
  );
}

/** A two-choice setting (design 3.1); read-only once published ("Fixé depuis la publication"). */
function SettingField<K extends string>({
  label,
  published,
  value,
  segments,
  onChange,
  helper,
  testIDPrefix,
}: {
  label: string;
  published: boolean;
  value: K;
  segments: { key: K; label: string }[];
  onChange: (key: K) => void;
  helper: string;
  testIDPrefix: string;
}) {
  const { t } = useTranslation();
  const current = segments.find((segment) => segment.key === value)?.label ?? '';
  return (
    <View className="gap-xs" testID={`form-${testIDPrefix}`}>
      <Text className="text-body text-ink-2">{label}</Text>
      {published ? (
        <View
          accessible
          accessibilityLabel={`${label}, ${current}. ${t('events.dropoff.fixedSincePublish')}`}
          className="flex-row items-center gap-sm rounded-md bg-shell p-md"
          testID={`form-${testIDPrefix}-readonly`}
        >
          <Text className="flex-1 text-body font-medium text-ink">{current}</Text>
          <Icon icon={Lock} size={16} color="ink-2" />
          <Text className="text-caption text-ink-2">{t('events.dropoff.fixedSincePublish')}</Text>
        </View>
      ) : (
        <>
          <SegmentedControl
            accessibilityLabel={label}
            segments={segments}
            value={value}
            onChange={onChange}
            testIDPrefix={testIDPrefix}
          />
          <Text className="text-caption text-ink-3">{helper}</Text>
        </>
      )}
    </View>
  );
}

/** The age range, optional, or required for a drop-off event (AC-17.4). */
function AgeRange({
  label,
  values,
  set,
  error,
  inputRef,
}: {
  label: string;
  values: FormValues;
  set: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  error?: string;
  inputRef: RefObject<TextInput | null>;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-xs">
      <Text className="text-body text-ink-2">{label}</Text>
      <View role="group" accessibilityLabel={label} className="flex-row items-end gap-sm">
        <View className="flex-1">
          <TextField
            ref={inputRef}
            kind="number"
            label={t('events.form.ageFrom')}
            value={values.ageMin}
            onChangeText={(v) => set('ageMin', v)}
            maxLength={2}
            error={error}
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
            error={error}
            hideErrorText
            testID="form-age-max"
          />
        </View>
        <Text className="pb-3 text-body text-ink-2">{t('events.form.years')}</Text>
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-sm">
      <Text className="text-caption text-ink-2">{label}</Text>
      <Text className="shrink text-right text-caption font-medium text-ink">{value}</Text>
    </View>
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
