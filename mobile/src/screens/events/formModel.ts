import type { TFunction } from 'i18next';

import type { EventParams, JoinRule, SparkEvent } from '../../api/events';
import type { FieldErrorKey } from '../../api/types';
import type { CategoryKey } from '../../components/CategoryPill';
import { zonedDate, zonedParts, zonedToUtc } from './format';

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
  day: string;
  month: string;
  year: string;
  start: string;
  end: string;
  area: string | null;
  address: string;
  places: string;
  joinRule: JoinRule;
  description: string;
  ageMin: string;
  ageMax: string;
  tags: string[];
};

export type Field =
  | 'title'
  | 'category'
  | 'date'
  | 'time'
  | 'area'
  | 'address'
  | 'places'
  | 'joinRule'
  | 'description'
  | 'age'
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
  'joinRule',
  'description',
  'age',
  'tags',
];

export type FormErrors = Partial<Record<Field, string>>;

/** Empty form: nothing pre-filled, places empty, "Anyone" (AC-1.3, PM decision Q5). */
export const EMPTY_FORM: FormValues = {
  title: '',
  category: null,
  day: '',
  month: '',
  year: '',
  start: '',
  end: '',
  area: null,
  address: '',
  places: '',
  joinRule: 'anyone',
  description: '',
  ageMin: '',
  ageMax: '',
  tags: [],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The form values of an existing event (edit), in the event's local time. */
export function formFromEvent(event: SparkEvent): FormValues {
  const start = zonedParts(new Date(event.starts_at), event.time_zone);
  const end = zonedParts(new Date(event.ends_at), event.time_zone);
  return {
    title: event.title,
    category: event.category,
    day: String(start.day),
    month: String(start.month),
    year: String(start.year),
    start: `${pad(start.hour)}:${pad(start.minute)}`,
    end: `${pad(end.hour)}:${pad(end.minute)}`,
    area: event.area.key,
    address: event.exact_address ?? '',
    places: String(event.places.total),
    joinRule: event.join_rule,
    description: event.description ?? '',
    ageMin: event.age_min === null ? '' : String(event.age_min),
    ageMax: event.age_max === null ? '' : String(event.age_max),
    tags: [...event.tags],
  };
}

/** "15:00", "15h30", "1530", "9" → "15:00", "15:30", "15:30", "09:00"; null if not a time. */
export function parseTime(text: string): string | null {
  const match = /^(\d{1,2})(?:[:hH.]?(\d{2}))?[hH]?$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "10", "10", "2026" → "2026-10-10", or null if it isn't a real day. */
export function parseDay(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day.trim()) || !/^\d{1,2}$/.test(month.trim())) return null;
  if (!/^\d{4}$/.test(year.trim())) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
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

/** Checks the form like the API does, with the design's messages (design E5 table). */
export function validateForm(
  values: FormValues,
  t: TFunction,
  { now = new Date(), placesTaken = 0 }: { now?: Date; placesTaken?: number } = {},
): FormErrors {
  const errors: FormErrors = {};
  if (!values.title.trim()) errors.title = t('events.form.titleError');
  else if (values.title.trim().length > LIMITS.title)
    errors.title = t('events.form.tooLong', { count: LIMITS.title });
  if (!values.category) errors.category = t('events.form.categoryError');

  const day = parseDay(values.day, values.month, values.year);
  const today = zonedDate(now, EVENT_TIME_ZONE);
  if (!day || day < today) errors.date = t('events.form.dateError');

  const start = parseTime(values.start);
  const end = parseTime(values.end);
  if (!start || !end) errors.time = t('events.form.timeFormat');
  else if (end <= start) errors.time = t('events.form.timeError');
  else if (day && !errors.date && zonedToUtc(day, start, EVENT_TIME_ZONE) <= now.toISOString())
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

  if (values.tags.length > LIMITS.tags) errors.tags = t('events.form.tagsMax');
  return errors;
}

/** The request body (POST / PATCH). Times go to UTC from the event's local time. */
export function toParams(values: FormValues, { includeRule }: { includeRule: boolean }) {
  const day = parseDay(values.day, values.month, values.year);
  const start = parseTime(values.start);
  const end = parseTime(values.end);
  const params: EventParams = {
    title: values.title.trim(),
    description: values.description.trim(),
    starts_at: day && start ? zonedToUtc(day, start, EVENT_TIME_ZONE) : undefined,
    ends_at: day && end ? zonedToUtc(day, end, EVENT_TIME_ZONE) : undefined,
    area: values.area ?? undefined,
    exact_address: values.address.trim(),
    places_total: /^\d+$/.test(values.places.trim()) ? Number(values.places) : undefined,
    age_min: values.ageMin.trim() ? Number(values.ageMin) : null,
    age_max: values.ageMax.trim() ? Number(values.ageMax) : null,
    tags: values.tags,
  };
  if (includeRule) {
    params.category = values.category ?? undefined;
    params.join_rule = values.joinRule;
  }
  return params;
}

/** True when a published event's change must be told to participants (AC-7.2). */
export function notifiesParticipants(before: FormValues, after: FormValues): boolean {
  const keys: (keyof FormValues)[] = [
    'title',
    'day',
    'month',
    'year',
    'start',
    'end',
    'area',
    'address',
    'places',
  ];
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
};

/** The API's `validation_failed` details as the design's field messages. */
export function serverErrors(
  details: Record<string, FieldErrorKey[]> | undefined,
  t: TFunction,
  placesTaken: number,
): FormErrors {
  const errors: FormErrors = {};
  for (const [apiField, keys] of Object.entries(details ?? {})) {
    const field = FIELD_OF[apiField];
    const key = keys[0];
    if (!field || !key || errors[field]) continue;
    errors[field] = fieldMessage(field, key, t, placesTaken);
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
      return key === 'invalid_range' ? t('events.form.ageError') : t('events.form.ageRange');
    case 'tags':
      return tagMessage(key, t);
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
