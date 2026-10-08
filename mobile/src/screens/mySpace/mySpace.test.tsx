import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { AccessibilityInfo, Dimensions, ScrollView } from 'react-native';

import MySpaceTab from '../../app/(tabs)/my-space';
import type { MyCircles } from '../../api/circles';
import type { SparkEvent } from '../../api/events';
import type { AgendaPage } from '../../api/mySpace';
import type { Me } from '../../api/types';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import {
  mockCircles,
  mockEvents,
  mockMySpace,
  offlineError,
  resetApiMock,
} from '../../test/apiMock';
import { myCircles } from '../../test/circleFixtures';
import { eventFixture, eventPage, hostedEvent, joinedEvent } from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { addDays } from '../events/format';
import { AgendaScreen } from './AgendaScreen';
import { todayInZone } from './agenda';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const ROUTES = {
  'my-space': MySpaceTab,
  agenda: AgendaScreen,
  'events/[id]/index': routeStub('event'),
  'events/[id]/requests': routeStub('requests'),
  'events/new': routeStub('new-event'),
  'circles/[id]/index': routeStub('circle'),
  'circles/[id]/members': routeStub('members'),
  community: routeStub('community'),
  'verify/index': routeStub('verify'),
  index: routeStub('events'),
};

const HOUR = 60 * 60 * 1000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const onDay = (offset: number, hourUtc = 9) =>
  `${addDays(todayInZone(), offset)}T${String(hourUtc).padStart(2, '0')}:00:00Z`;

function outing(base: SparkEvent, id: string, startsAt: string, extra: Partial<SparkEvent> = {}) {
  return { ...base, id, title: `Sortie ${id}`, starts_at: startsAt, ends_at: startsAt, ...extra };
}

function agenda(events: SparkEvent[], nextFrom: string | null = null): AgendaPage {
  return {
    events,
    window: { from: todayInZone(), to: addDays(todayInZone(), 29), next_from: nextFrom },
  };
}

const noCircles: MyCircles = { items: [], limits: myCircles.limits };

async function open(url = '/my-space', me: Me = meFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, me);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

const notVerified: Me = {
  ...meFixture,
  verification: {
    ...meFixture.verification,
    status: 'not_verified',
    verified: false,
    expires_on: null,
  },
};

beforeEach(async () => {
  resetApiMock();
  mockCircles.mine.mockResolvedValue(noCircles);
  await i18n.changeLanguage('fr');
});

describe('My space header and segments (spec my-space 5, AC-7.3, AC-7.6)', () => {
  it("has the bell, no avatar button, and two labelled tabs opening on « Aujourd'hui »", async () => {
    await open();
    expect(await screen.findByRole('header', { name: 'Mon espace' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeOnTheScreen();
    expect(screen.queryByTestId('account-entry')).toBeNull();
    expect(screen.getByRole('tab', { name: "Aujourd'hui", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Mon compte', selected: false })).toBeOnTheScreen();
  });

  it('switches to « Mon compte » and shows the dot when verification is to do', async () => {
    await open('/my-space', notVerified);
    expect(await screen.findByTestId('my-space-segment-account-dot')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mon compte' }));
    expect(await screen.findByTestId('account-panel')).toBeOnTheScreen();
  });

  it('keeps the title, bell and segments fixed above the scrolling panel', async () => {
    await open();
    const scroll = screen.getByTestId('my-space-scroll');
    expect(await within(scroll).findByTestId('today-panel')).toBeOnTheScreen();
    expect(within(scroll).queryByRole('header', { name: 'Mon espace' })).toBeNull();
    expect(within(scroll).queryByTestId('notifications-entry')).toBeNull();
    expect(within(scroll).queryByRole('tab', { name: "Aujourd'hui" })).toBeNull();
    expect(screen.getByRole('tab', { name: "Aujourd'hui" })).toBeOnTheScreen();
  });
});

describe('Next outing (US-1, AC-1.1, AC-1.2, AC-1.4)', () => {
  it('shows my next outing first with its role, and repeats it in the agenda', async () => {
    const next = outing(hostedEvent, 'h1', onDay(3));
    const later = outing(joinedEvent, 'j1', onDay(4));
    mockMySpace.agenda.mockResolvedValue(
      agenda([outing(eventFixture, 'c1', onDay(1), { visibility: 'circles' }), next, later]),
    );
    await open();
    const card = await screen.findByTestId('next-outing');
    expect(within(card).getByText('Sortie h1')).toBeOnTheScreen();
    expect(within(card).getByText('Je reçois')).toBeOnTheScreen();
    expect(within(card).queryByTestId('next-outing-soon')).toBeNull();
    expect(
      within(screen.getByTestId('agenda-list')).getByTestId('agenda-row-h1'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
    expect(within(screen.getAllByTestId('agenda-row-c1')[0]!).getByText('Voir')).toBeOnTheScreen();
  });

  it('AC-1.2 marks an outing within 24 hours and opens the event detail', async () => {
    const soon = outing(joinedEvent, 'soon', inHours(2));
    mockMySpace.agenda.mockResolvedValue(agenda([soon]));
    const { app } = await open();
    const card = await screen.findByTestId('next-outing');
    expect(within(card).getByTestId('next-outing-soon')).toBeOnTheScreen();
    expect(within(card).getByText("J'y vais")).toBeOnTheScreen();
    expect(within(card).getByText(/adresse exacte/)).toBeOnTheScreen();
    await fireEvent.press(card);
    await waitFor(() => expect(app.getPathname()).toBe('/events/soon'));
  });

  it('AC-1.1 pages forward until it finds the next outing, whatever the date', async () => {
    const far = outing(hostedEvent, 'far', onDay(80));
    mockMySpace.agenda
      .mockResolvedValueOnce(agenda([], addDays(todayInZone(), 80)))
      .mockResolvedValueOnce(agenda([far]));
    await open();
    expect(await screen.findByTestId('next-outing')).toBeOnTheScreen();
    expect(mockMySpace.agenda).toHaveBeenLastCalledWith(
      addDays(todayInZone(), 80),
      expect.anything(),
    );
  });
});

describe('À valider (US-3)', () => {
  it('AC-3.1 AC-3.2 lists my events and circles with requests, and opens the request lists', async () => {
    mockEvents.mine.mockImplementation(async (role: string) =>
      role === 'host'
        ? eventPage([outing(hostedEvent, 'req', onDay(5), { pending_requests_count: 3 })])
        : eventPage([]),
    );
    mockCircles.mine.mockResolvedValue(myCircles);
    mockMySpace.agenda.mockResolvedValue(agenda([outing(hostedEvent, 'req', onDay(5))]));
    const { app } = await open();

    expect(await screen.findByRole('header', { name: 'À valider' })).toBeOnTheScreen();
    const eventRow = screen.getByRole('button', {
      name: 'Sortie req, 3 demandes de participation',
    });
    expect(
      screen.getByRole('button', { name: 'Parents CE2 · Jaurès, 2 demandes pour rejoindre' }),
    ).toBeOnTheScreen();
    // AC-3.3: my own circle request is a quiet line.
    expect(screen.getByText('En attente de réponse : Voisins du square')).toBeOnTheScreen();

    await fireEvent.press(eventRow);
    await waitFor(() => expect(app.getPathname()).toBe('/events/req/requests'));
  });

  it('AC-3.4 shows no « À valider » heading when nothing waits', async () => {
    mockMySpace.agenda.mockResolvedValue(agenda([outing(joinedEvent, 'j', onDay(2))]));
    await open();
    await screen.findByTestId('agenda-block');
    expect(screen.queryByRole('header', { name: 'À valider' })).toBeNull();
  });
});

describe('Agenda (PM request 2026-10-07)', () => {
  it('shows the week strip with day labels, cancelled outings and the full agenda link', async () => {
    const events = [
      outing(hostedEvent, 'n', onDay(0, 20)),
      outing(joinedEvent, 'x', onDay(1), { status: 'cancelled' }),
      ...[2, 3, 4, 5, 6, 7].map((day) => outing(joinedEvent, `d${day}`, onDay(day))),
    ];
    mockMySpace.agenda.mockResolvedValue(agenda(events));
    const { app } = await open();

    const strip = await screen.findByTestId('week-strip');
    expect(within(strip).getAllByRole('button')).toHaveLength(7);
    expect(within(strip).getByRole('button', { name: /, 1 sortie annulée$/ })).toBeOnTheScreen();
    expect(within(screen.getByTestId('agenda-row-x')).getByText('Annulée')).toBeOnTheScreen();
    // 5 day groups inline (the next outing's day included), then the full agenda.
    expect(screen.getByTestId('agenda-row-n')).toBeOnTheScreen();
    expect(screen.getByTestId('agenda-row-d4')).toBeOnTheScreen();
    expect(screen.queryByTestId('agenda-row-d5')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: "Voir tout l'agenda" }));
    await waitFor(() => expect(app.getPathname()).toBe('/agenda'));
  });

  it('AC-1.3b by default no day is selected and the list shows the coming days', async () => {
    mockMySpace.agenda.mockResolvedValue(
      agenda([outing(hostedEvent, 'h1', onDay(2)), outing(joinedEvent, 'j1', onDay(4))]),
    );
    await open();
    const strip = await screen.findByTestId('week-strip');
    expect(within(strip).queryByRole('button', { selected: true })).toBeNull();
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Tout voir' })).toBeOnTheScreen();
    // One Agenda block: the strip and the list share the same card.
    const card = screen.getByTestId('agenda-card');
    expect(within(card).getByTestId('week-strip')).toBeOnTheScreen();
    expect(within(card).getByTestId('agenda-list')).toBeOnTheScreen();
  });

  it('AC-1.3b tapping a day filters the list to it without scrolling; tapping again clears', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockMySpace.agenda.mockResolvedValue(
      agenda([
        outing(hostedEvent, 'h1', onDay(2)),
        outing(joinedEvent, 'h2', onDay(2, 15)),
        outing(joinedEvent, 'j1', onDay(4)),
      ]),
    );
    await open();
    const day = screen.getByTestId('strip-day-' + addDays(todayInZone(), 2));
    await screen.findByTestId('agenda-row-j1');
    scrollTo.mockClear();

    await fireEvent.press(day);
    expect(screen.getByTestId('agenda-row-h1')).toBeOnTheScreen();
    expect(screen.getByTestId('agenda-row-h2')).toBeOnTheScreen();
    expect(screen.queryByTestId('agenda-row-j1')).toBeNull();
    expect(day).toBeSelected();
    expect(screen.queryByRole('link', { name: 'Tout voir' })).toBeNull();
    expect(screen.queryByTestId('agenda-see-full')).toBeNull();
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^2 sorties le \p{Ll}/u));
    expect(scrollTo).not.toHaveBeenCalled();

    await fireEvent.press(day);
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
    expect(day).not.toBeSelected();

    await fireEvent.press(day);
    await fireEvent.press(screen.getByRole('link', { name: 'Tous les jours' }));
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Tout voir' })).toBeOnTheScreen();
    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
    announce.mockRestore();
  });

  it('AC-1.3b an empty selected day says so and offers « Trouver une sortie »', async () => {
    mockMySpace.agenda.mockResolvedValue(agenda([outing(hostedEvent, 'h1', onDay(2))]));
    const { app } = await open();
    await screen.findByTestId('agenda-row-h1');
    await fireEvent.press(screen.getByTestId('strip-day-' + addDays(todayInZone(), 3)));
    expect(screen.getByText('Rien de prévu ce jour-là')).toBeOnTheScreen();
    expect(screen.queryByTestId('agenda-row-h1')).toBeNull();
    await fireEvent.press(
      within(screen.getByTestId('agenda-day-empty')).getByRole('link', {
        name: 'Trouver une sortie',
      }),
    );
    await waitFor(() => expect(app.getPathname()).toBe('/'));
  });

  it('AC-1.3b the full Agenda filters by the tapped day the same way', async () => {
    mockMySpace.agenda.mockResolvedValue(
      agenda([outing(hostedEvent, 'h1', onDay(2)), outing(joinedEvent, 'j1', onDay(1))]),
    );
    await open('/agenda');
    await screen.findByTestId('agenda-row-j1');
    const day = screen.getByTestId('strip-day-' + addDays(todayInZone(), 1));
    await fireEvent.press(day);
    expect(screen.queryByTestId('agenda-row-h1')).toBeNull();
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
    expect(day).toBeSelected();

    await fireEvent.press(screen.getByTestId('strip-day-' + addDays(todayInZone(), 0)));
    expect(screen.getByText('Rien de prévu ce jour-là')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Tous les jours' }));
    expect(screen.getByTestId('agenda-row-h1')).toBeOnTheScreen();
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
  });

  it('AC-1.3b a day past the loaded pages loads them before filtering', async () => {
    mockMySpace.agenda
      .mockResolvedValueOnce(
        agenda([outing(hostedEvent, 'h1', onDay(2))], addDays(todayInZone(), 30)),
      )
      .mockResolvedValueOnce(agenda([outing(joinedEvent, 'far', onDay(35))]));
    await open();
    await screen.findByTestId('agenda-row-h1');
    for (let week = 0; week < 5; week += 1)
      await fireEvent(
        screen.getByTestId('strip-day-' + addDays(todayInZone(), week * 7)),
        'accessibilityAction',
        { nativeEvent: { actionName: 'nextWeek' } },
      );
    await fireEvent.press(await screen.findByTestId('strip-day-' + addDays(todayInZone(), 35)));
    expect(await screen.findByTestId('agenda-row-far')).toBeOnTheScreen();
    expect(screen.queryByTestId('agenda-row-h1')).toBeNull();
  });

  it('shows the empty agenda box when circles exist but nothing is planned', async () => {
    mockCircles.mine.mockResolvedValue({ ...myCircles, items: [myCircles.items[0]!] });
    await open();
    expect(await screen.findByText('Tes prochaines sorties apparaîtront ici.')).toBeOnTheScreen();
    expect(screen.queryByTestId('welcome')).toBeNull();
  });

  it("the full Agenda loads 30 days a page and ends with « C'est tout pour l'instant »", async () => {
    mockMySpace.agenda
      .mockResolvedValueOnce(
        agenda([outing(joinedEvent, 'p1', onDay(2))], addDays(todayInZone(), 40)),
      )
      .mockResolvedValueOnce(agenda([outing(hostedEvent, 'p2', onDay(40))]));
    await open('/agenda');
    expect(await screen.findByTestId('agenda-row-p1')).toBeOnTheScreen();
    expect(await screen.findByTestId('agenda-row-p2')).toBeOnTheScreen();
    expect(await screen.findByText("C'est tout pour l'instant")).toBeOnTheScreen();
  });
});

describe('Agenda week navigation (design 2026-10-08, option A)', () => {
  const day = (offset: number) => 'strip-day-' + addDays(todayInZone(), offset);
  const textSize = (fontScale: number) => {
    const size = { width: 375, height: 812, scale: 3, fontScale };
    Dimensions.set({ window: size, screen: size });
  };

  // The React Native jest mock reports a fontScale of 2 (accessibility sizes): default text here.
  beforeEach(() => textSize(1));
  afterEach(() => {
    screen.unmount();
    textSize(2);
  });

  it('shows a month label and 5 days, previous disabled at today, next moving by 5', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockMySpace.agenda.mockResolvedValue(agenda([outing(hostedEvent, 'h1', onDay(6))]));
    await open('/agenda');
    await screen.findByTestId('agenda-row-h1');
    const window = screen.getByTestId('agenda-window');
    expect(within(window).getByRole('header')).toHaveTextContent(/^[a-zéû.]+ \d{2}$/i);
    expect(within(window).getAllByTestId(/^strip-day-/)).toHaveLength(5);
    expect(screen.getByTestId(day(0))).toBeOnTheScreen();
    expect(screen.queryByTestId(day(5))).toBeNull();
    expect(
      screen.getByTestId('agenda-window-previous', { includeHiddenElements: true }),
    ).toBeDisabled();
    expect(screen.queryByTestId('agenda-window-today')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Jours suivants' }));
    expect(screen.queryByTestId(day(0))).toBeNull();
    expect(screen.getByTestId(day(5))).toBeOnTheScreen();
    expect(screen.getByTestId(day(9))).toBeOnTheScreen();
    expect(announce).toHaveBeenLastCalledWith(expect.stringMatching(/^Du \S+ \d+ .*au \S+ \d+ /));
    expect(
      screen.getByTestId('agenda-window-previous', { includeHiddenElements: true }),
    ).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Jours précédents' }));
    expect(screen.getByTestId(day(0))).toBeOnTheScreen();
    expect(
      screen.getByTestId('agenda-window-previous', { includeHiddenElements: true }),
    ).toBeDisabled();
  });

  it("« Aujourd'hui » shows only when today is out of view and moves the window only", async () => {
    mockMySpace.agenda.mockResolvedValue(agenda([outing(hostedEvent, 'h1', onDay(1))]));
    await open('/agenda');
    await screen.findByTestId('agenda-row-h1');
    await fireEvent.press(screen.getByTestId(day(1)));
    await fireEvent.press(screen.getByRole('button', { name: 'Jours suivants' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Jours suivants' }));

    await fireEvent.press(screen.getByRole('button', { name: "Revenir à aujourd'hui" }));
    expect(screen.getByTestId(day(0))).not.toBeSelected();
    expect(screen.getByTestId(day(1))).toBeSelected();
    expect(screen.queryByTestId('agenda-window-today')).toBeNull();
  });

  it('keeps the day filter when the window moves; « Tous les jours » still clears it', async () => {
    mockMySpace.agenda.mockResolvedValue(
      agenda([outing(hostedEvent, 'h1', onDay(2)), outing(joinedEvent, 'j1', onDay(7))]),
    );
    await open('/agenda');
    await screen.findByTestId('agenda-row-j1');
    await fireEvent.press(screen.getByTestId(day(2)));
    await fireEvent.press(screen.getByRole('button', { name: 'Jours suivants' }));

    expect(screen.queryByTestId(day(2))).toBeNull();
    expect(screen.getByTestId('agenda-row-h1')).toBeOnTheScreen();
    expect(screen.queryByTestId('agenda-row-j1')).toBeNull();
    // Strip and list stay one Agenda card.
    const card = screen.getByTestId('agenda-card');
    expect(within(card).getByTestId('agenda-window')).toBeOnTheScreen();
    expect(within(card).getByTestId('agenda-row-h1')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Tous les jours' }));
    expect(screen.getByTestId('agenda-row-h1')).toBeOnTheScreen();
    expect(screen.getByTestId('agenda-row-j1')).toBeOnTheScreen();
    expect(screen.getByTestId(day(5))).toBeOnTheScreen();
  });

  it('has no swipe handler on the strip (the iOS back gesture always wins)', async () => {
    await open('/agenda');
    const window = await screen.findByTestId('agenda-window');
    const card = screen.getByTestId('agenda-card');
    for (const node of [window, card, ...within(window).getAllByTestId(/^strip-day-/)])
      expect(node.props.onMoveShouldSetResponder).toBeUndefined();
    expect(window.props.onResponderRelease).toBeUndefined();
  });

  it('loads further pages when the window moves past the loaded days', async () => {
    mockMySpace.agenda
      .mockResolvedValueOnce(
        agenda([outing(hostedEvent, 'h1', onDay(2))], addDays(todayInZone(), 30)),
      )
      .mockResolvedValueOnce(agenda([outing(joinedEvent, 'far', onDay(31))]));
    await open('/agenda');
    await screen.findByTestId('agenda-row-h1');
    await fireEvent.press(screen.getByTestId(day(2)));
    for (let step = 0; step < 6; step += 1)
      await fireEvent.press(screen.getByRole('button', { name: 'Jours suivants' }));
    await waitFor(() => expect(mockMySpace.agenda).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole('button', { name: /, 1 sortie : Sortie far$/ }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('agenda-row-h1')).toBeOnTheScreen();
  });

  it('shows 3 days at accessibility text sizes', async () => {
    textSize(2);
    await open('/agenda');
    const window = await screen.findByTestId('agenda-window');
    expect(within(window).getAllByTestId(/^strip-day-/)).toHaveLength(3);
    await fireEvent.press(screen.getByRole('button', { name: 'Jours suivants' }));
    expect(screen.getByTestId(day(3))).toBeOnTheScreen();
  });
});

describe('Mes cercles (US-5)', () => {
  it('AC-5.1 AC-5.2 shows my circles with news and the circle outings I can join', async () => {
    mockCircles.mine.mockResolvedValue({
      ...myCircles,
      items: [
        {
          ...myCircles.items[0]!,
          circle: { ...(myCircles.items[0] as { circle: object }).circle, new: true },
        } as MyCircles['items'][number],
      ],
    });
    mockMySpace.agenda.mockResolvedValue(
      agenda([outing(eventFixture, 'co', onDay(3), { visibility: 'circles' })]),
    );
    await open();
    const card = await screen.findByRole('link', {
      name: 'Parents CE2 · Jaurès, Paris 11e, 12 familles, Nouveau',
    });
    expect(card).toBeOnTheScreen();
    expect(within(screen.getByTestId('circle-outings')).getByText('Sortie co')).toBeOnTheScreen();
  });

  it('AC-5.4 invites to join or create a circle when in none', async () => {
    mockMySpace.agenda.mockResolvedValue(agenda([outing(joinedEvent, 'j', onDay(2))]));
    await open();
    expect(await screen.findByText("Aucun cercle pour l'instant.")).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Rejoindre ou créer un cercle' })).toBeOnTheScreen();
  });
});

describe('Empty, loading and errors (US-6)', () => {
  it('AC-6.1 a new verified parent gets the welcome card and the three entry points', async () => {
    const { app } = await open();
    expect(
      await screen.findByRole('header', { name: 'Bienvenue chez SparkCircles' }),
    ).toBeOnTheScreen();
    const buttons = within(screen.getByTestId('welcome'))
      .getAllByRole('button')
      .map((node) => node.props.accessibilityLabel);
    expect(buttons).toEqual(['Trouver une sortie', 'Organiser une sortie', 'Rejoindre un cercle']);
    expect(screen.queryByTestId('agenda-block')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rejoindre un cercle' }));
    await waitFor(() => expect(app.getPathname()).toBe('/community'));
  });

  it('AC-6.1 AC-U.1 a new unverified parent sees the verification card above the welcome', async () => {
    await open('/my-space', notVerified);
    expect(await screen.findByTestId('welcome')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-note')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Organiser une sortie' })).toBeNull();
  });

  it('AC-6.3 a failed block shows « Réessayer » without hiding the others', async () => {
    mockMySpace.agenda
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(agenda([outing(joinedEvent, 'back', onDay(2))]));
    mockCircles.mine.mockResolvedValue({ ...myCircles, items: [myCircles.items[0]!] });
    await open();
    expect(await screen.findByTestId('agenda-error')).toBeOnTheScreen();
    expect(screen.getByTestId('circles-block')).toBeOnTheScreen();
    await fireEvent.press(within(screen.getByTestId('agenda-error')).getByRole('button'));
    expect(await screen.findByTestId('next-outing')).toBeOnTheScreen();
  });

  it('shows the offline banner when the network is gone', async () => {
    mockMySpace.agenda.mockRejectedValue(offlineError());
    await open();
    expect(await screen.findByTestId('my-space-offline')).toBeOnTheScreen();
    expect(screen.getByText('Pas de connexion')).toBeOnTheScreen();
  });
});

describe('English copy', () => {
  it('AC-1.3b « All days » and the empty day in English', async () => {
    await act(() => i18n.changeLanguage('en'));
    mockMySpace.agenda.mockResolvedValue(agenda([outing(hostedEvent, 'h1', onDay(2))]));
    await open();
    await screen.findByTestId('agenda-row-h1');
    await fireEvent.press(screen.getByTestId('strip-day-' + addDays(todayInZone(), 3)));
    expect(screen.getByText('Nothing planned that day')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Find an outing' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'All days' })).toBeOnTheScreen();
  });

  it('M-21 shows My space in English', async () => {
    await act(() => i18n.changeLanguage('en'));
    await open();
    expect(await screen.findByRole('tab', { name: 'Today' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'My account' })).toBeOnTheScreen();
    expect(await screen.findByText('Welcome to SparkCircles')).toBeOnTheScreen();
  });
});
