import i18n from '../../i18n';
import { addDays, formatShortDay, weekendRange, zonedToUtc } from './format';
import {
  checkTag,
  EMPTY_FORM,
  type FormValues,
  notifiesParticipants,
  parseTime,
  serverErrors,
  toParams,
  validateForm,
} from './formModel';
import { clampParty } from './JoinSheet';
import { groupByDay, textSearch } from './DiscoverList';
import { eventFixture } from '../../test/eventFixtures';

const t = i18n.t.bind(i18n);
const NOW = new Date('2026-10-06T10:00:00Z');

const valid: FormValues = {
  ...EMPTY_FORM,
  title: 'Foot au parc',
  category: 'sport',
  day: '10',
  month: '10',
  year: '2026',
  start: '15:00',
  end: '17:00',
  area: 'paris-11',
  address: '12 rue Oberkampf',
  places: '10',
};

beforeEach(() => i18n.changeLanguage('fr'));

describe('event times (contract: UTC + Europe/Paris)', () => {
  it('converts Paris wall-clock times to UTC, summer and winter', () => {
    expect(zonedToUtc('2026-10-10', '15:00', 'Europe/Paris')).toBe('2026-10-10T13:00:00.000Z');
    expect(zonedToUtc('2026-12-10', '15:00', 'Europe/Paris')).toBe('2026-12-10T14:00:00.000Z');
  });

  it('writes card days like the mockups', () => {
    expect(formatShortDay('2026-10-10T13:00:00Z', 'Europe/Paris', 'fr')).toBe('Sam. 10 oct.');
    expect(formatShortDay('2026-10-10T13:00:00Z', 'Europe/Paris', 'en')).toBe('Sat 10 Oct');
  });

  it('AC-3.2 "this weekend" is Saturday and Sunday (today only on a Sunday)', () => {
    expect(weekendRange('2026-10-06')).toEqual({ from: '2026-10-10', to: '2026-10-11' });
    expect(weekendRange('2026-10-10')).toEqual({ from: '2026-10-10', to: '2026-10-11' });
    expect(weekendRange('2026-10-11')).toEqual({ from: '2026-10-11', to: '2026-10-11' });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('E5 form rules', () => {
  it('AC-1.2 accepts a complete form and sends UTC times', () => {
    expect(validateForm(valid, t, { now: NOW })).toEqual({});
    expect(toParams(valid, { includeRule: true })).toMatchObject({
      title: 'Foot au parc',
      category: 'sport',
      starts_at: '2026-10-10T13:00:00.000Z',
      ends_at: '2026-10-10T15:00:00.000Z',
      area: 'paris-11',
      places_total: 10,
      join_rule: 'anyone',
      age_min: null,
    });
  });

  it('AC-1.3 starts empty: no address, no places, "Anyone"', () => {
    expect(EMPTY_FORM.address).toBe('');
    expect(EMPTY_FORM.places).toBe('');
    expect(EMPTY_FORM.joinRule).toBe('anyone');
  });

  it('AC-1.2 AC-1.6 says what to fix, with the design copy', () => {
    const errors = validateForm(
      { ...valid, title: '', day: '1', end: '14:00', places: '0', ageMin: '9', ageMax: '4' },
      t,
      { now: NOW },
    );
    expect(errors).toEqual({
      title: 'Ajoute un titre.',
      date: "Choisis un jour qui n'est pas passé.",
      time: 'La fin doit être après le début.',
      places: 'Indique un nombre de 1 à 100.',
      age: 'Le premier âge doit être le plus petit.',
    });
    expect(validateForm({ ...valid, places: '1.5' }, t, { now: NOW }).places).toBe(
      'Indique un nombre de 1 à 100.',
    );
  });

  it('AC-7.2 places cannot go below the places taken', () => {
    expect(validateForm({ ...valid, places: '4' }, t, { now: NOW, placesTaken: 6 }).places).toBe(
      '6 places sont déjà prises : indique 6 ou plus.',
    );
  });

  it('reads times typed in several ways', () => {
    expect(parseTime('15h30')).toBe('15:30');
    expect(parseTime('9')).toBe('09:00');
    expect(parseTime('1530')).toBe('15:30');
    expect(parseTime('25:00')).toBeNull();
  });

  it('AC-3.8 normalises tags and refuses spaces, punctuation and lengths', () => {
    expect(checkTag('#Plein-Air')).toEqual({ tag: 'plein-air' });
    expect(checkTag('goûter')).toEqual({ tag: 'goûter' });
    expect(checkTag('a')).toEqual({ error: 'tooShort' });
    expect(checkTag('x'.repeat(25))).toEqual({ error: 'tooLong' });
    expect(checkTag('foo@bar')).toEqual({ error: 'invalid' });
  });

  it('AC-3.9 shows the API tag refusals in plain words', () => {
    expect(serverErrors({ tags: ['contains_email'] }, t, 0).tags).toBe(
      "Un tag ne peut pas contenir de lien, d'e-mail, de numéro de téléphone, de @pseudo ou d'adresse.",
    );
    expect(serverErrors({ tags: ['banned_word'] }, t, 0).tags).toBe(
      "Ce mot n'est pas autorisé dans un tag. Choisis-en un autre.",
    );
    expect(serverErrors({ starts_at: ['in_past'] }, t, 0).date).toBe(
      "Choisis un jour qui n'est pas passé.",
    );
  });

  it('AC-7.2 tells participants about title, time, place or places, not tags', () => {
    expect(notifiesParticipants(valid, { ...valid, tags: ['foot'] })).toBe(false);
    expect(notifiesParticipants(valid, { ...valid, start: '16:00' })).toBe(true);
  });
});

describe('E1 list and E3 sheet rules', () => {
  it('AC-3.1 groups results by day, soonest first', () => {
    const later = { ...eventFixture, id: 'b', starts_at: '2026-10-11T08:00:00Z' };
    const rows = groupByDay([eventFixture, { ...eventFixture, id: 'a' }, later], (iso) =>
      iso.slice(0, 10),
    );
    expect(rows.map((r) => r.kind)).toEqual(['day', 'event', 'event', 'day', 'event']);
  });

  it('AC-3.10 "#tag" searches the tag, other text the title', () => {
    expect(textSearch('#Foot')).toEqual({ tag: 'foot' });
    expect(textSearch('parc')).toEqual({ q: 'parc' });
    expect(textSearch('p')).toEqual({});
  });

  it('AC-5.2 AC-5.3 keeps at least one adult within the places left', () => {
    expect(clampParty(2, 2, 2)).toEqual({ adults: 2, children: 0 });
    expect(clampParty(1, 3, 2)).toEqual({ adults: 1, children: 1 });
    expect(clampParty(3, 0, 1)).toEqual({ adults: 1, children: 0 });
  });
});
