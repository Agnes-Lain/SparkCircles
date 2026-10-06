// QA (events mobile): criteria and rules not covered by the developer's tests.
// `it.failing` documents a confirmed bug (see docs/qa/events-mobile.md): the test passes while
// the bug exists and starts failing when it is fixed, so turn it into `it` then.
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { AccessibilityInfo } from 'react-native';

import { eventKey, myEventsKey } from '../../api/events';
import enJson from '../../i18n/en.json';
import frJson from '../../i18n/fr.json';
import type { Me } from '../../api/types';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { ApiError } from '../../api/errors';
import { mockAuth, mockEvents, resetApiMock } from '../../test/apiMock';
import {
  eventFixture,
  eventOptionsFixture,
  eventPage,
  joinedEvent,
} from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { AREA_KEY } from '../../screens/events/areaStore';
import { EventDetailScreen } from '../../screens/events/EventDetailScreen';
import { EventFormScreen } from '../../screens/events/EventFormScreen';
import { EventsScreen } from '../../screens/events/EventsScreen';
import { serverErrors } from '../../screens/events/formModel';
import { refreshEvents } from '../../screens/events/queries';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const ROUTES = {
  index: EventsScreen,
  'events/[id]/index': EventDetailScreen,
  'events/[id]/edit': EventFormScreen,
  'events/new': EventFormScreen,
  verify: routeStub('verify'),
};

async function open(url: string, me: Me = meFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, me);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

const secureStore = SecureStore as unknown as { __reset: () => void };

const flat = (value: unknown, path = ''): [string, string][] =>
  typeof value === 'string'
    ? [[path, value]]
    : Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
        flat(v, path ? `${path}.${k}` : k),
      );

describe('QA Events copy rules (design section 3, PM rule "tu" everywhere)', () => {
  const fr = flat((frJson as { events: unknown }).events);
  const en = flat((enJson as { events: unknown }).events);

  it('EN and FR carry the same Events keys', () => {
    expect(fr.map(([k]) => k.replace(/_(one|other)$/, '')).sort()).toEqual(
      en.map(([k]) => k.replace(/_(one|other)$/, '')).sort(),
    );
  });

  it('FR says "e-mail", never "email", and has no inclusive "·e" or "(e)"', () => {
    for (const [key, text] of fr) {
      expect([key, /\bemails?\b/i.test(text)]).toEqual([key, false]);
      expect([key, /·e|\(e\)|\.e\./.test(text)]).toEqual([key, false]);
    }
  });

  // BUG-2: "Que ferez-vous ?" (form.descriptionPlaceholder), "Pour vous retrouver"
  // (detail.hostCancelledBody).
  it.failing('FR uses "tu" everywhere: no "vous", "votre", "vos", "-vous"', () => {
    const offenders = fr.filter(([, text]) => /\bvous\b|\bvotre\b|\bvos\b|-vous\b/i.test(text));
    expect(offenders).toEqual([]);
  });
});

describe('QA Events form: server errors land on the right field (422)', () => {
  it('AC-7.2 below_taken on places_total shows the "already taken" message on Places', async () => {
    await i18n.changeLanguage('fr');
    const errors = serverErrors({ places_total: ['below_taken'] }, i18n.t, 6);
    expect(errors.places).toBe('6 places sont déjà prises : indique 6 ou plus.');
    const more = serverErrors(
      { starts_at: ['in_past'], tags: ['banned_word'], age_min: ['invalid_range'] },
      i18n.t,
      0,
    );
    expect(more.date).toBe("Choisis un jour qui n'est pas passé.");
    expect(more.tags).toBe("Ce mot n'est pas autorisé dans un tag. Choisis-en un autre.");
    expect(more.age).toBe('Le premier âge doit être le plus petit.');
  });
});

describe('QA Events cache: the exact address (AC-6.3)', () => {
  // BUG-1: after a leave the cached detail (with `exact_address`, `participants`,
  // `my_participation`) is only marked stale; it stays readable until the refetch answers.
  it.failing('after refreshEvents (what a leave calls) the cached event has no address', () => {
    const client = new QueryClient();
    client.setQueryData(eventKey(joinedEvent.id), joinedEvent);
    client.setQueryData(myEventsKey('participant', 'upcoming'), {
      pages: [eventPage([joinedEvent])],
      pageParams: [1],
    });
    refreshEvents(client, joinedEvent.id);
    const cached = client.getQueryData<typeof joinedEvent>(eventKey(joinedEvent.id));
    expect(cached?.exact_address).toBeUndefined();
    expect(
      JSON.stringify(client.getQueryData(myEventsKey('participant', 'upcoming'))),
    ).not.toContain(joinedEvent.exact_address);
  });
});

describe('QA Events screens', () => {
  beforeEach(async () => {
    resetApiMock();
    secureStore.__reset();
    mockAuth.me.mockResolvedValue(meFixture);
    mockEvents.options.mockResolvedValue(eventOptionsFixture);
    mockEvents.search.mockResolvedValue(eventPage([eventFixture]));
    mockEvents.mine.mockResolvedValue(eventPage([]));
    mockEvents.get.mockResolvedValue({ event: eventFixture });
    await SecureStore.setItemAsync(AREA_KEY, 'paris-11');
    await i18n.changeLanguage('fr');
  });
  afterEach(() => jest.restoreAllMocks());

  it('AC-5.8 a rate-limited join stays in the sheet with the rate-limit notice', async () => {
    mockEvents.join.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'x'));
    await open(`/events/${eventFixture.id}`);
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByTestId('join-rate-limited')).toBeOnTheScreen();
    expect(screen.getByTestId('join-confirm')).toBeOnTheScreen();
  });

  it('a11y: the join celebration plays unless the system asks for reduced motion', async () => {
    mockEvents.join.mockResolvedValue({ event: joinedEvent });
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await open(`/events/${eventFixture.id}`);
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    await screen.findByTestId('going-badge');
    expect(screen.queryByTestId('confetti')).toBeNull();
  });

  // BUG-3: only some refusals are mapped; the others read "We couldn't reach SparkCircles".
  it.failing('AC-5.8 an already_joined refusal is not shown as "no connection"', async () => {
    mockEvents.join.mockRejectedValueOnce(new ApiError(409, 'already_joined', 'x'));
    await open(`/events/${eventFixture.id}`);
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    await waitFor(() => expect(mockEvents.join).toHaveBeenCalled());
    expect(screen.queryByTestId('join-offline')).toBeNull();
  });

  // BUG-4: /events/:id/edit opened on someone else's event (a link) shows the full form.
  // This test pins today's behaviour; when fixed, expect the form to be absent (redirect).
  it('BUG-4 (open) the edit form opens for a member who is not the host', async () => {
    await open(`/events/${eventFixture.id}/edit`);
    expect(await screen.findByTestId('event-form')).toBeOnTheScreen();
  });
});
