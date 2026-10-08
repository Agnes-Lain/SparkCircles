import type { TFunction } from 'i18next';

import type {
  EventLanguage,
  EventParams,
  EventVisibility,
  JoinRule,
  SparkEvent,
} from '../../api/events';
import type { FieldErrorKey } from '../../api/types';
import type { CategoryKey } from '../../components/CategoryPill';
import { zonedDate, zonedParts, zonedToUtc } from './format';
import { displayPhone, normalizePhone } from './phone';

// The create / edit form (design E5) as plain data, so its rules are tested without a screen.

export const EVENT_TIME_ZONE = 'Europe/Paris';
export const LIMITS = {
  title: 80,
  description: 1000,
  address: 200,
  tags: 5,
  tagMin: 2,
  tagMax: 24,
};

export type FormValues = {
  title: string;
  category: CategoryKey | null;
  /** "2026-10-10", from the native date picker (BUG-5). */
  date: string | null;
  /** "15:00", from the native time pickers. */
  start: string | null;
  end: string | null;
  area: string | null;
  address: string;
  places: string;
  joinRule: JoinRule;
  /** AC-16.1: pre-selected from the app language. */
  language: EventLanguage;
  description: string;
  ageMin: string;
  ageMax: string;
  tags: string[];
  /** AC-17.1: "Présence d'un adulte : obligatoire" (true, default) or "facultatif" (drop-off). */
  adultRequired: boolean;
  /** AC-17.13: "Validation des participations : je valide chaque demande". */
  approvalRequired: boolean;
  /** The host chose the validation by hand: kept when they toggle the adult setting. */
  approvalChosen: boolean;
  /** AC-17.9: the host's phone for this event (drop-off only), never from the profile. */
  hostPhone: string;
  /** Circles AC-16.1: "Tous les membres de SparkCircles" or "Mes cercles". */
  visibility: EventVisibility;
  /** Circles AC-16.1: the chosen circles (only circles the host is in). */
  circleIds: string[];
};

export type Field =
  | 'title'
  | 'category'
  | 'date'
  | 'time'
  | 'area'
  | 'address'
  | 'places'
  | 'circles'
  | 'joinRule'
  | 'description'
  | 'age'
  | 'phone'
  | 'tags';

/** Screen order, for "focus goes to the first field in error". */
export const FIELD_ORDER: readonly Field[] = [
  'title',
  'category',
  'date',
  'time',
  'area',
  'address',
  'places',
  'circles',
  'joinRule',
  'description',
  'age',
  'phone',
  'tags',
];

/** Drop-off: the age range and the phone sit right after the places (design 3.1). */
export const DROPOFF_FIELD_ORDER: readonly Field[] = [
  'title',
  'category',
  'date',
  'time',
  'area',
  'address',
  'places',
  'age',
  'phone',
  'circles',
  'joinRule',
  'description',
  'tags',
];

export type FormErrors = Partial<Record<Field, string>>;

/** Empty form: nothing pre-filled, places empty, "Anyone" (AC-1.3, PM decision Q5). */
export const EMPTY_FORM: FormValues = {
  title: '',
  category: null,
  date: null,
  start: null,
  end: null,
  area: null,
  address: '',
  places: '',
  joinRule: 'anyone',
  language: 'fr',
  description: '',
  ageMin: '',
  ageMax: '',
  tags: [],
  adultRequired: true,
  approvalRequired: false,
  approvalChosen: false,
  hostPhone: '',
  visibility: 'searchable',
  circleIds: [],
};

/** A new event's form, its language pre-selected from the app language (AC-16.1). */
export function emptyForm(language: EventLanguage): FormValues {
  return { ...EMPTY_FORM, language };
}

const pad = (n: number) => String(n).padStart(2, '0');

const clock = (iso: string, timeZone: string) => {
  const parts = zonedParts(new Date(iso), timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
};

/** The form values of an existing event (edit), in the event's local time. A draft may
 *  have empty fields (BUG-8). */
export function formFromEvent(event: SparkEvent): FormValues {
  return {
    title: event.title ?? '',
    category: event.category,
    date: event.starts_at ? zonedDate(event.starts_at, event.time_zone) : null,
    start: event.starts_at ? clock(event.starts_at, event.time_zone) : null,
    end: event.ends_at ? clock(event.ends_at, event.time_zone) : null,
    area: event.area?.key ?? null,
    address: event.exact_address ?? '',
    places: event.places.total === null ? '' : String(event.places.total),
    joinRule: event.join_rule,
    language: event.language ?? 'fr',
    description: event.description ?? '',
    ageMin: event.age_min === null ? '' : String(event.age_min),
    ageMax: event.age_max === null ? '' : String(event.age_max),
    tags: [...event.tags],
    adultRequired: event.adult_required ?? true,
    approvalRequired: event.approval_required ?? false,
    approvalChosen: true,
    hostPhone: event.host_phone ? displayPhone(event.host_phone) : '',
    visibility: event.visibility ?? 'searchable',
    circleIds: (event.circles ?? []).map((circle) => circle.id),
  };
}

/**
 * AC-17.1, AC-17.8: choosing "Facultatif" presets "Je valide chaque demande", unless the
 * host already chose the validation by hand (design 3.1). Typed values stay on the device.
 */
export function withAdultRequired(values: FormValues, adultRequired: boolean): FormValues {
  const next = { ...values, adultRequired };
  if (!values.approvalChosen) next.approvalRequired = !adultRequired;
  return next;
}

/** "2026-10-10" and "09:05" from a picked moment, in the device's local time (what the
 *  native picker shows). */
export function localDay(moment: Date): string {
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}
export function localClock(moment: Date): string {
  return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

/** The moment to open a picker on: the chosen day and time, as device-local values. */
export function pickerValue(date: string | null, time: string | null, fallback: Date): Date {
  const base = date ? new Date(`${date}T00:00:00`) : new Date(fallback);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    base.setHours(h ?? 0, m ?? 0, 0, 0);
  }
  return base;
}

/** A whole number in a range, or null ("1.5" and "abc" are refused, never truncated). */
function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

// ASCII punctuation and spaces, except the hyphen: tags are letters, digits and hyphens.
const TAG_FORBIDDEN = /[\s!-,./:-@[-`{-~]/;

export type TagCheck = { tag: string } | { error: 'tooShort' | 'tooLong' | 'invalid' } | null;

/** A typed tag: "#Foot" → "foot"; empty input gives null. The API checks the rest. */
export function checkTag(text: string): TagCheck {
  const tag = text.trim().replace(/^#+/, '').toLowerCase();
  if (!tag) return null;
  if (TAG_FORBIDDEN.test(tag)) return { error: 'invalid' };
  if ([...tag].length < LIMITS.tagMin) return { error: 'tooShort' };
  if ([...tag].length > LIMITS.tagMax) return { error: 'tooLong' };
  return { tag };
}

export const TAG_ERROR_KEY = {
  tooShort: 'events.form.tagTooShort',
  tooLong: 'events.form.tagTooLong',
  invalid: 'events.form.tagInvalid',
} as const;

/**
 * Checks the form like the API does at publish, with the design's messages (design E5
 * table). `checkStart`: the start must be ahead (drafts being published, or a published
 * event whose date or times change); a started event can still be fixed (BUG-7, the API's
 * `Event#editable?`).
 */
export function validateForm(
  values: FormValues,
  t: TFunction,
  {
    now = new Date(),
    placesTaken = 0,
    checkStart = true,
  }: { now?: Date; placesTaken?: number; checkStart?: boolean } = {},
): FormErrors {
  const errors: FormErrors = {};
  if (!values.title.trim()) errors.title = t('events.form.titleError');
  else if (values.title.trim().length > LIMITS.title)
    errors.title = t('events.form.tooLong', { count: LIMITS.title });
  if (!values.category) errors.category = t('events.form.categoryError');

  const day = values.date;
  const today = zonedDate(now, EVENT_TIME_ZONE);
  if (!day || (checkStart && day < today)) errors.date = t('events.form.dateError');

  const { start, end } = values;
  if (!start || !end) errors.time = t('events.form.timeRequired');
  else if (end <= start) errors.time = t('events.form.timeError');
  else if (
    checkStart &&
    day &&
    !errors.date &&
    zonedToUtc(day, start, EVENT_TIME_ZONE) <= now.toISOString()
  )
    errors.date = t('events.form.dateError');

  if (!values.area) errors.area = t('events.form.areaError');
  if (!values.address.trim()) errors.address = t('events.form.addressError');
  else if (values.address.trim().length > LIMITS.address)
    errors.address = t('events.form.tooLong', { count: LIMITS.address });

  const places = wholeNumber(values.places, 1, 100);
  if (places === null) errors.places = t('events.form.placesError');
  else if (places < placesTaken)
    errors.places = t('events.form.placesBelowTaken', { count: placesTaken });

  if (values.description.trim().length > LIMITS.description)
    errors.description = t('events.form.tooLong', { count: LIMITS.description });

  const ageMin = values.ageMin.trim() ? wholeNumber(values.ageMin, 0, 17) : undefined;
  const ageMax = values.ageMax.trim() ? wholeNumber(values.ageMax, 0, 17) : undefined;
  if (ageMin === null || ageMax === null) errors.age = t('events.form.ageRange');
  else if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax)
    errors.age = t('events.form.ageError');
  // AC-17.4, AC-17.11: a drop-off event needs the age range and a valid host phone.
  else if (!values.adultRequired && (ageMin === undefined || ageMax === undefined))
    errors.age = t('events.dropoff.ageMissing');
  if (!values.adultRequired) {
    if (!values.hostPhone.trim()) errors.phone = t('events.dropoff.phoneMissing');
    else if (!normalizePhone(values.hostPhone)) errors.phone = t('events.dropoff.phoneInvalid');
  }

  // Circles AC-16.1: at least one circle for a circle outing.
  if (values.visibility === 'circles' && values.circleIds.length === 0)
    errors.circles = t('circles.eventForm.chooseCircle');

  if (values.tags.length > LIMITS.tags) errors.tags = t('events.form.tagsMax');
  return errors;
}

/**
 * The request body (POST / PATCH). Times go to UTC from the event's local time. A draft
 * saves whatever is typed (BUG-8): what is missing is sent as null.
 */
export function toParams(values: FormValues, { includeRule }: { includeRule: boolean }) {
  const { date: day, start, end } = values;
  const params: EventParams = {
    title: values.title.trim(),
    description: values.description.trim(),
    starts_at: day && start ? zonedToUtc(day, start, EVENT_TIME_ZONE) : null,
    ends_at: day && end ? zonedToUtc(day, end, EVENT_TIME_ZONE) : null,
    area: values.area,
    exact_address: values.address.trim(),
    places_total: /^\d+$/.test(values.places.trim()) ? Number(values.places) : null,
    age_min: values.ageMin.trim() ? Number(values.ageMin) : null,
    age_max: values.ageMax.trim() ? Number(values.ageMax) : null,
    tags: values.tags,
    language: values.language,
    // AC-17.9: only for a drop-off event; sent as typed when the API must refuse it.
    host_phone: values.adultRequired
      ? null
      : (normalizePhone(values.hostPhone) ?? (values.hostPhone.trim() || null)),
  };
  if (includeRule) {
    params.category = values.category;
    // AC-17.3: a drop-off event is always verified members only.
    // Circles AC-16.1: the join rule of a circle outing is "all members of these circles".
    params.join_rule = !values.adultRequired
      ? 'verified_only'
      : values.visibility === 'circles'
        ? 'anyone'
        : values.joinRule;
    params.visibility = values.visibility;
    params.circle_ids = values.visibility === 'circles' ? values.circleIds : [];
    params.adult_required = values.adultRequired;
    params.approval_required = values.approvalRequired;
  }
  return params;
}

/** True when the day or the times changed (the start is then checked again, BUG-7). */
export function startChanged(before: FormValues, after: FormValues): boolean {
  return before.date !== after.date || before.start !== after.start;
}

/** The required fields still empty, in screen order, for "Still to fill in" (BUG-8). */
export function missingFields(values: FormValues): Field[] {
  const missing: Field[] = [];
  if (!values.title.trim()) missing.push('title');
  if (!values.category) missing.push('category');
  if (!values.date) missing.push('date');
  if (!values.start || !values.end) missing.push('time');
  if (!values.area) missing.push('area');
  if (!values.address.trim()) missing.push('address');
  if (!values.places.trim()) missing.push('places');
  if (!values.adultRequired && (!values.ageMin.trim() || !values.ageMax.trim()))
    missing.push('age');
  if (!values.adultRequired && !values.hostPhone.trim()) missing.push('phone');
  if (values.visibility === 'circles' && values.circleIds.length === 0) missing.push('circles');
  return missing;
}

/** True when a published event's change must be told to participants (AC-7.2). */
export function notifiesParticipants(before: FormValues, after: FormValues): boolean {
  const keys: (keyof FormValues)[] = ['title', 'date', 'start', 'end', 'area', 'address', 'places'];
  return keys.some((key) => String(before[key]).trim() !== String(after[key]).trim());
}

const FIELD_OF: Record<string, Field> = {
  title: 'title',
  description: 'description',
  category: 'category',
  starts_at: 'date',
  ends_at: 'time',
  area: 'area',
  exact_address: 'address',
  places_total: 'places',
  age_min: 'age',
  age_max: 'age',
  tags: 'tags',
  join_rule: 'joinRule',
  host_phone: 'phone',
  circle_ids: 'circles',
  visibility: 'circles',
};

/**
 * The API's `validation_failed` details as the design's field messages. `newTags`: the tags
 * added since the last save; when only one is new, a refused tag is named (BUG-9), except
 * for a banned word, which is never echoed (AC-3.9).
 */
export function serverErrors(
  details: Record<string, FieldErrorKey[]> | undefined,
  t: TFunction,
  placesTaken: number,
  newTags: string[] = [],
): FormErrors {
  const errors: FormErrors = {};
  for (const [apiField, keys] of Object.entries(details ?? {})) {
    const field = FIELD_OF[apiField];
    const key = keys[0];
    if (!field || !key || errors[field]) continue;
    errors[field] = fieldMessage(field, key, t, placesTaken);
    if (field === 'tags' && newTags.length === 1 && !keys.includes('banned_word'))
      errors.tags = t('events.form.tagNamed', { tag: newTags[0], message: errors.tags });
  }
  return errors;
}

function fieldMessage(field: Field, key: FieldErrorKey, t: TFunction, placesTaken: number) {
  if (key === 'not_editable') return t('events.form.readOnly');
  switch (field) {
    case 'title':
      return key === 'too_long'
        ? t('events.form.tooLong', { count: LIMITS.title })
        : t('events.form.titleError');
    case 'description':
      return t('events.form.tooLong', { count: LIMITS.description });
    case 'category':
      return t('events.form.categoryError');
    case 'date':
      return t('events.form.dateError');
    case 'time':
      return t('events.form.timeError');
    case 'area':
      return t('events.form.areaError');
    case 'address':
      return key === 'too_long'
        ? t('events.form.tooLong', { count: LIMITS.address })
        : t('events.form.addressError');
    case 'places':
      return key === 'below_taken'
        ? t('events.form.placesBelowTaken', { count: placesTaken })
        : t('events.form.placesError');
    case 'age':
      if (key === 'blank') return t('events.dropoff.ageMissing');
      return key === 'invalid_range' ? t('events.form.ageError') : t('events.form.ageRange');
    case 'phone':
      return key === 'blank' ? t('events.dropoff.phoneMissing') : t('events.dropoff.phoneInvalid');
    case 'tags':
      return tagMessage(key, t);
    case 'circles':
      return t('circles.eventForm.chooseCircle');
    default:
      return t('events.form.readOnly');
  }
}

/** AC-3.8, 3.9: the reason a tag is refused, in plain words (never echoing a banned word). */
export function tagMessage(key: FieldErrorKey, t: TFunction): string {
  switch (key) {
    case 'too_short':
      return t('events.form.tagTooShort');
    case 'too_long':
      return t('events.form.tagTooLong');
    case 'too_many':
      return t('events.form.tagsMax');
    case 'contains_email':
    case 'contains_phone':
    case 'contains_link':
    case 'contains_handle':
    case 'contains_address':
      return t('events.form.tagContact');
    case 'banned_word':
      return t('events.form.tagBanned');
    default:
      return t('events.form.tagInvalid');
  }
}
