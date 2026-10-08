import i18n from '../../i18n';
import type { SparkEvent } from '../../api/events';
import { eventFixture, hostedEvent, joinedEvent } from '../../test/eventFixtures';
import {
  agendaKind,
  dayDots,
  dayFilterAnnouncement,
  dayHeader,
  groupByDay,
  inlineGroups,
  monthHeader,
  nextOuting,
  stripCellLabel,
  stripDays,
  todayInZone,
} from './agenda';

const at = (event: SparkEvent, id: string, startsAt: string): SparkEvent => ({
  ...event,
  id,
  starts_at: startsAt,
  ends_at: startsAt,
});

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('agenda helpers (design my-space 2.3)', () => {
  it('tells my outings, circle outings and cancelled ones apart', () => {
    expect(agendaKind(hostedEvent)).toBe('mine');
    expect(agendaKind(joinedEvent)).toBe('mine');
    expect(agendaKind({ ...eventFixture, visibility: 'circles' })).toBe('circle');
    expect(agendaKind({ ...joinedEvent, status: 'cancelled' })).toBe('cancelled');
  });

  it('AC-1.1 the next outing is the first one I host or go to, never cancelled', () => {
    const circle = at(eventFixture, 'c', '2026-10-08T08:00:00Z');
    const cancelled = at({ ...joinedEvent, status: 'cancelled' }, 'x', '2026-10-08T09:00:00Z');
    const mine = at(hostedEvent, 'h', '2026-10-09T08:00:00Z');
    expect(nextOuting([circle, cancelled, mine])?.id).toBe('h');
    expect(nextOuting([circle])).toBeUndefined();
  });

  it('groups by Paris day, late evening UTC counting as the next Paris day', () => {
    const groups = groupByDay([
      at(hostedEvent, 'a', '2026-10-07T08:00:00Z'),
      at(joinedEvent, 'b', '2026-10-07T22:30:00Z'), // 00:30 on the 8th in Paris
      at(eventFixture, 'c', '2026-10-08T10:00:00Z'),
    ]);
    expect(groups.map((group) => [group.day, group.events.map((e) => e.id)])).toEqual([
      ['2026-10-07', ['a']],
      ['2026-10-08', ['b', 'c']],
    ]);
  });

  it('keeps up to 5 day groups or 8 rows inline, whichever comes first', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      at(hostedEvent, `d${i}`, `2026-10-${String(10 + i)}T08:00:00Z`),
    );
    const byDay = inlineGroups(groupByDay(days));
    expect(byDay.groups).toHaveLength(5);
    expect(byDay.truncated).toBe(true);

    const busy = Array.from({ length: 10 }, (_, i) =>
      at(hostedEvent, `b${i}`, `2026-10-10T0${i}:00:00Z`),
    );
    const byRows = inlineGroups(groupByDay(busy));
    expect(byRows.groups[0]!.events).toHaveLength(8);
    expect(byRows.truncated).toBe(true);
    expect(inlineGroups(groupByDay(days.slice(0, 2))).truncated).toBe(false);
  });

  it('rolls the strip from today and moves by 7 days', () => {
    expect(stripDays('2026-10-07')).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
    ]);
    expect(stripDays('2026-10-28', 1)[0]).toBe('2026-11-04');
  });

  it('shows at most 3 dots', () => {
    const many = [1, 2, 3, 4].map((i) => at(hostedEvent, `m${i}`, '2026-10-10T08:00:00Z'));
    expect(dayDots(many)).toEqual(['mine', 'mine', 'mine']);
  });

  it('AC-1.3b announces the filtered day in French and English', () => {
    const t = i18n.t.bind(i18n);
    expect(dayFilterAnnouncement('2026-10-07', 2, 'fr', t)).toBe('2 sorties le mercredi 7 octobre');
    expect(dayFilterAnnouncement('2026-10-07', 1, 'fr', t)).toBe('1 sortie le mercredi 7 octobre');
    expect(dayFilterAnnouncement('2026-10-08', 0, 'fr', t)).toBe('Rien de prévu ce jour-là');
  });

  it('AC-1.3b announces the filtered day in English', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.t.bind(i18n);
    expect(dayFilterAnnouncement('2026-10-07', 2, 'en', t)).toBe(
      '2 outings on Wednesday 7 October',
    );
    expect(dayFilterAnnouncement('2026-10-08', 0, 'en', t)).toBe('Nothing planned that day');
  });

  it('writes day and month headers in French and English', () => {
    const t = i18n.t.bind(i18n);
    expect(dayHeader('2026-10-07', '2026-10-07', 'fr', t)).toBe("Aujourd'hui · mer. 7 oct.");
    expect(dayHeader('2026-10-08', '2026-10-07', 'fr', t)).toBe('Demain');
    expect(dayHeader('2026-10-09', '2026-10-07', 'fr', t)).toBe('Vendredi 9 oct.');
    expect(monthHeader('2026-11-02', 'fr')).toBe('Novembre 2026');
    expect(dayHeader('2026-10-09', '2026-10-07', 'en', t)).toBe('Friday 9 Oct');
    expect(monthHeader('2026-11-02', 'en')).toBe('November 2026');
  });

  it('labels strip days for screen readers (design 5)', () => {
    const t = i18n.t.bind(i18n);
    const outing = at(hostedEvent, 'p', '2026-10-07T08:00:00Z');
    expect(stripCellLabel('2026-10-07', '2026-10-07', [outing], 'fr', t)).toBe(
      "Mercredi 7 octobre, aujourd'hui, 1 sortie : Goûter et jeux au parc",
    );
    expect(stripCellLabel('2026-10-08', '2026-10-07', [], 'fr', t)).toBe(
      'Jeudi 8 octobre, rien de prévu',
    );
    expect(
      stripCellLabel('2026-10-08', '2026-10-07', [{ ...outing, status: 'cancelled' }], 'fr', t),
    ).toBe('Jeudi 8 octobre, 1 sortie annulée');
  });

  it('knows today in Paris', () => {
    expect(todayInZone(new Date('2026-10-07T22:30:00Z'))).toBe('2026-10-08');
  });
});
