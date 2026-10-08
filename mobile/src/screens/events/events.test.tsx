import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SparkEvent } from '../../api/events';
import type { Me } from '../../api/types';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { apiError, mockAuth, mockEvents, offlineError, resetApiMock } from '../../test/apiMock';
import {
  eventFixture,
  eventOptionsFixture,
  eventPage,
  hostedEvent,
  joinedEvent,
} from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { AREA_KEY } from './areaStore';
import { EventDetailScreen } from './EventDetailScreen';
import { EventFormScreen } from './EventFormScreen';
import { EventsScreen } from './EventsScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const ROUTES = {
  index: EventsScreen,
  'events/[id]/index': EventDetailScreen,
  'events/[id]/edit': EventFormScreen,
  'events/new': EventFormScreen,
  verify: routeStub('verify'),
};

const notVerifiedMe: Me = {
  ...meFixture,
  verification: { ...meFixture.verification, status: 'not_verified', verified: false },
};

async function open(url: string, me: Me = meFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, me);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

const secureStore = SecureStore as unknown as { __reset: () => void };

beforeEach(async () => {
  resetApiMock();
  secureStore.__reset();
  mockAuth.me.mockResolvedValue(meFixture);
  mockEvents.options.mockResolvedValue(eventOptionsFixture);
  mockEvents.search.mockResolvedValue(eventPage([eventFixture]));
  mockEvents.mine.mockResolvedValue(eventPage([]));
  // Times are checked against "now": fake the date only, not the timers.
  jest.useFakeTimers({
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'hrtime',
    ],
  });
  jest.setSystemTime(new Date('2026-10-06T10:00:00Z'));
  await i18n.changeLanguage('fr');
});

afterEach(() => jest.useRealTimers());

async function withArea(area = 'paris-11') {
  await SecureStore.setItemAsync(AREA_KEY, area);
}

describe('E1 Sorties, À découvrir', () => {
  it('AC-3.3 starts on "Tout Paris" with no forced area step (PM decision 2026-10-06)', async () => {
    await open('/');
    expect(await screen.findByText('Goûter et jeux au parc')).toBeOnTheScreen();
    expect(screen.queryByText('Où cherches-tu des sorties ?')).toBeNull();
    expect(mockEvents.search).toHaveBeenCalledWith({}, 1, expect.anything());
    expect(screen.getByTestId('area-selector')).toHaveTextContent('Tout Paris');
    expect(
      screen.getByRole('button', { name: 'Zone : Tout Paris. Modifier la zone' }),
    ).toBeOnTheScreen();
  });

  it('AC-3.3 E1c picks several arrondissements, summarises them and keeps them on the device', async () => {
    await open('/');
    await fireEvent.press(await screen.findByTestId('area-selector'));
    expect(await screen.findByText('Où cherches-tu des sorties ?')).toBeOnTheScreen();
    expect(screen.getByTestId('area-all')).toBeChecked();
    // QA R2-3 (PM decision): no "Utiliser ma position" row until location ships (backlog #25).
    expect(screen.queryByText(/ma position/i)).toBeNull();
    expect(screen.getByText(/Nous n'utilisons jamais ta position/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('area-paris-20'));
    await fireEvent.press(screen.getByTestId('area-paris-11'));
    expect(screen.getByTestId('area-all')).not.toBeChecked();
    expect(screen.getByText('2 arrondissements sélectionnés')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('area-use'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-20', 'paris-11'] },
        1,
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('area-selector')).toHaveTextContent('Paris 11e, 20e');
    expect(
      screen.getByRole('button', { name: 'Zone : Paris 11e, 20e. Modifier la zone' }),
    ).toBeOnTheScreen();
    expect(await SecureStore.getItemAsync(AREA_KEY)).toBe('paris-20,paris-11');
  });

  it('AC-3.3 E1c three areas read "3 arrondissements"; "Effacer" goes back to "Tout Paris"', async () => {
    await withArea('paris-11,paris-12,paris-20');
    await open('/');
    await waitFor(() =>
      expect(screen.getByTestId('area-selector')).toHaveTextContent('3 arrondissements'),
    );
    expect(
      screen.getByRole('button', { name: 'Zone : Paris 11e, 12e, 20e. Modifier la zone' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('area-selector'));
    await fireEvent.press(await screen.findByTestId('area-clear'));
    expect(screen.getByTestId('area-all')).toBeChecked();
    await fireEvent.press(screen.getByTestId('area-use'));
    await waitFor(() =>
      expect(screen.getByTestId('area-selector')).toHaveTextContent('Tout Paris'),
    );
    expect(mockEvents.search).toHaveBeenLastCalledWith({}, 1, expect.anything());
  });

  it('BUG-6 an empty page with a next page keeps loading instead of "no events"', async () => {
    await withArea();
    mockEvents.search
      .mockResolvedValueOnce(eventPage([], 2))
      .mockResolvedValueOnce(eventPage([], 3))
      .mockResolvedValueOnce(eventPage([{ ...eventFixture, id: 'third', title: 'Foot' }]));
    await open('/');
    expect(await screen.findByText('Foot')).toBeOnTheScreen();
    expect(mockEvents.search).toHaveBeenLastCalledWith(
      { area: ['paris-11'] },
      3,
      expect.anything(),
    );
    expect(screen.queryByTestId('events-empty')).toBeNull();
  });

  it('BUG-6 stops after a few empty pages and shows the empty state', async () => {
    await withArea();
    mockEvents.search.mockImplementation(async (_s: unknown, page: number) =>
      eventPage([], page + 1),
    );
    await open('/');
    expect(await screen.findByTestId('events-empty')).toBeOnTheScreen();
    expect(mockEvents.search).toHaveBeenCalledTimes(5);
  });

  it('AC-3.1 AC-3.4 lists events by day under the header, with the create button', async () => {
    await withArea();
    await open('/');
    expect(await screen.findByText('Goûter et jeux au parc')).toBeOnTheScreen();
    expect(screen.getByText('Samedi 10 octobre')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Créer ma sortie' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'À découvrir' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Tout' })).toBeSelected();
  });

  it('AC-3.2 filters by category and date, shows the count and clears all', async () => {
    await withArea();
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.press(screen.getByTestId('category-sport'));
    await fireEvent.press(screen.getByTestId('date-weekend'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-11'], category: ['sport'], from: '2026-10-10', to: '2026-10-11' },
        1,
        expect.anything(),
      ),
    );
    expect(screen.getByText('2 filtres actifs')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tout' })).not.toBeSelected();
    await fireEvent.press(screen.getByTestId('clear-all'));
    expect(screen.queryByText('2 filtres actifs')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tout' })).toBeSelected();
  });

  it('AC-3.2 "Choisir une date" uses the native picker (today to 6 months), shows the day and clears it', async () => {
    await withArea();
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir une date' }));
    const picker = screen.getByTestId('date-pick-picker');
    expect(picker.props.minimumDate).toBe(new Date(2026, 9, 6).getTime());
    expect(picker.props.maximumDate).toBe(new Date(2027, 3, 6).getTime());
    expect(picker.props.locale).toBe('fr-FR');
    // Dark-mode bug: the iOS picker stays light (white text on the white sheet otherwise).
    expect(picker.props.themeVariant).toBe('light');
    expect(picker.props.accessibilityLabel).toBe('Choisir une date');
    await fireEvent(picker, 'onChange', {
      nativeEvent: { timestamp: new Date(2026, 9, 12).getTime(), utcOffset: 0 },
    });
    await fireEvent.press(screen.getByTestId('date-pick-done'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-11'], from: '2026-10-12', to: '2026-10-12' },
        1,
        expect.anything(),
      ),
    );
    const chip = screen.getByRole('button', { name: 'Date choisie : Lun. 12 oct.' });
    expect(chip).toHaveTextContent('Lun. 12 oct.');
    expect(chip).toBeSelected();
    expect(screen.getByText('1 filtre actif')).toBeOnTheScreen();

    await fireEvent.press(chip);
    await fireEvent.press(screen.getByRole('button', { name: 'Effacer la date' }));
    expect(screen.queryByText('1 filtre actif')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choisir une date' })).not.toBeSelected();
  });

  it('AC-3.2 "Pick a date" opens the Android system dialog with a Clear button once chosen', async () => {
    const androidOpen = jest.spyOn(DateTimePickerAndroid, 'open').mockImplementation(() => {});
    jest.replaceProperty(Platform, 'OS', 'android');
    await withArea();
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.press(screen.getByTestId('date-pick'));
    const first = androidOpen.mock.calls[0]![0];
    expect(first).toMatchObject({ mode: 'date', neutralButton: undefined });
    await act(async () =>
      first.onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 9, 17)),
    );
    expect(screen.getByTestId('date-pick')).toHaveTextContent('Sam. 17 oct.');
    await fireEvent.press(screen.getByTestId('date-pick'));
    const second = androidOpen.mock.calls[1]![0];
    expect(second.neutralButton).toEqual({ label: 'Effacer la date' });
    await act(async () => second.onNeutralButtonPress?.());
    expect(screen.getByTestId('date-pick')).toHaveTextContent('Choisir une date');
    jest.restoreAllMocks();
  });

  it('AC-3.2 applies distance, child age and tag from the filters sheet', async () => {
    await withArea();
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.press(screen.getByTestId('filters-button'));
    await fireEvent.press(screen.getByTestId('radius-5'));
    await fireEvent.press(screen.getByTestId('age-3-5'));
    await fireEvent.changeText(screen.getByTestId('filter-tag'), '#Foot');
    await fireEvent.press(screen.getByTestId('filters-apply'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-11'], radius_km: 5, age_band: '3-5', tag: 'foot' },
        1,
        expect.anything(),
      ),
    );
  });

  it('AC-3.10 searches a "#tag" typed in the search field', async () => {
    await withArea();
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.changeText(screen.getByTestId('events-search'), '#parc');
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-11'], tag: 'parc' },
        1,
        expect.anything(),
      ),
    );
  });

  it('AC-3.10 a tag tapped on an event opens the list on that tag', async () => {
    await withArea();
    await open('/?tag=parc');
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenCalledWith(
        { area: ['paris-11'], tag: 'parc' },
        1,
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('events-search')).toHaveDisplayValue('#parc');
  });

  it('AC-3.5 empty nearby: widen the area (next distance) or create', async () => {
    await withArea();
    mockEvents.search.mockResolvedValue(eventPage([]));
    await open('/');
    expect(
      await screen.findByText("Aucune sortie près de chez toi pour l'instant"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('widen-area'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-11'], radius_km: 2 },
        1,
        expect.anything(),
      ),
    );
  });

  it('AC-3.5 empty after filtering: clear the filters', async () => {
    await withArea();
    mockEvents.search.mockResolvedValue(eventPage([]));
    await open('/');
    await screen.findByText("Aucune sortie près de chez toi pour l'instant");
    await fireEvent.press(screen.getByTestId('date-today'));
    expect(await screen.findByText('Aucune sortie ne correspond')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer les filtres' }));
    expect(await screen.findByText("Aucune sortie près de chez toi pour l'instant")).toBeTruthy();
  });

  it('loads the next page at the end of the list (contract pagination)', async () => {
    await withArea();
    mockEvents.search
      .mockResolvedValueOnce(eventPage([eventFixture], 2))
      .mockResolvedValueOnce(eventPage([{ ...eventFixture, id: 'second', title: 'Foot' }]));
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    await act(async () => {
      screen.getByTestId('events-list').props.onEndReached();
    });
    expect(await screen.findByText('Foot')).toBeOnTheScreen();
    expect(mockEvents.search).toHaveBeenLastCalledWith(
      { area: ['paris-11'] },
      2,
      expect.anything(),
    );
  });

  it('BUG-10 the loading list is announced to screen readers', async () => {
    await withArea();
    mockEvents.search.mockReturnValue(new Promise(() => {}));
    await open('/');
    expect(await screen.findByLabelText('Chargement des sorties')).toBeOnTheScreen();
  });

  it('shows the error notification with "Try again", and the rate-limit notice', async () => {
    await withArea();
    mockEvents.search.mockRejectedValueOnce(offlineError());
    await open('/');
    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    mockEvents.search.mockRejectedValueOnce(apiError(429, 'rate_limited'));
    await fireEvent.press(screen.getByTestId('events-retry'));
    expect(await screen.findByText("Trop d'essais pour le moment")).toBeOnTheScreen();
  });

  it('the map button says map search is coming soon', async () => {
    await withArea();
    await open('/');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Recherche sur carte, bientôt disponible' }),
    );
    expect(await screen.findByText('La recherche sur carte arrive bientôt')).toBeOnTheScreen();
  });
});

describe('E1b Mes sorties', () => {
  it('AC-7.1 shows the events I host and the ones I joined, upcoming then past', async () => {
    await withArea();
    mockEvents.mine.mockImplementation(async (role: string) =>
      eventPage(role === 'host' ? [{ ...hostedEvent, status: 'draft' }] : [joinedEvent]),
    );
    await open('/?tab=mine');
    expect(await screen.findByText("J'organise")).toBeOnTheScreen();
    expect(screen.getByText("J'y vais")).toBeOnTheScreen();
    expect(screen.getByText('Brouillon')).toBeOnTheScreen();
    expect(screen.getByText('Tu y vas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('mine-past'));
    await waitFor(() =>
      expect(mockEvents.mine).toHaveBeenCalledWith('host', 'past', 1, expect.anything()),
    );
  });
});

function detail(event: SparkEvent) {
  mockEvents.get.mockResolvedValue({ event });
  return open(`/events/${event.id}`);
}

describe('E2 Event detail, participant', () => {
  it('header: back and "⋯" are the 44 px header icon buttons (v1.8)', async () => {
    await detail(eventFixture);
    const more = await screen.findByTestId('more-options');
    expect(more).toHaveProp('accessibilityLabel', "Plus d'options");
    const back = screen.getByRole('button', { name: 'Retour' });
    for (const button of [more, back]) {
      expect(button).toHaveStyle({ width: 44, height: 44 });
    }
  });

  it('AC-6.1 AC-6.4 AC-4.3 before joining: area only, counts only, host and badge before the CTA', async () => {
    await detail(eventFixture);
    expect(
      await screen.findByText("L'adresse exacte t'est envoyée dès que tu rejoins la sortie."),
    ).toBeTruthy();
    expect(screen.queryByTestId('exact-address')).toBeNull();
    expect(
      screen.getByText("6 places prises. Les noms s'affichent quand tu rejoins la sortie."),
    ).toBeOnTheScreen();
    expect(screen.getByText('Camille D.')).toBeOnTheScreen();
    expect(screen.getByTestId('host-badge')).toBeOnTheScreen();
    expect(screen.getByText('15:00')).toBeOnTheScreen();
    expect(screen.getByText("Samedi 10 octobre · jusqu'à 17:00")).toBeOnTheScreen();
    expect(screen.getByText('Gratuit. Tu choisis combien de places il te faut.')).toBeTruthy();
  });

  it('AC-5.1 AC-5.2 AC-6.2 joins with 1 adult by default and reveals the address', async () => {
    mockEvents.join.mockResolvedValue({ event: joinedEvent });
    await detail(eventFixture);
    await fireEvent.press(await screen.findByTestId('join'));
    expect(screen.getByText('Combien de places ?')).toBeOnTheScreen();
    expect(screen.getByText('1 place sur les 4 restantes')).toBeOnTheScreen();
    expect(screen.getByTestId('adults-minus')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(mockEvents.join).toHaveBeenCalledWith(eventFixture.id, { adults: 1, children: 0 });
    expect(await screen.findByText('Tu y vas ! 1 place réservée.')).toBeOnTheScreen();
    expect(await screen.findByTestId('exact-address')).toHaveTextContent(
      '14 rue des Lilas, 75011 Paris',
    );
  });

  it('AC-5.2 stops "+" at the places left', async () => {
    await detail({ ...eventFixture, places: { total: 10, taken: 8, left: 2 } });
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('children-plus'));
    expect(screen.getByTestId('children-plus')).toBeDisabled();
    expect(screen.getByTestId('adults-plus')).toBeDisabled();
    expect(screen.getByText("C'est toutes les places restantes.")).toBeOnTheScreen();
  });

  it('AC-5.3 AC-5.8 a race leaves fewer places: the choice is clamped and explained', async () => {
    mockEvents.join.mockRejectedValueOnce(
      new (jest.requireActual('../../api/errors').ApiError)(
        409,
        'not_enough_places',
        'x',
        undefined,
        1,
      ),
    );
    await detail(eventFixture);
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('children-plus'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByText("Des places viennent d'être prises")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Il ne reste qu'une place. Nous avons ajusté ton choix : vérifie-le et confirme.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('children-value')).toHaveTextContent('0');
  });

  it('AC-5.3 AC-5.8 a race leaves no place: the event just became full', async () => {
    mockEvents.join.mockRejectedValueOnce(
      new (jest.requireActual('../../api/errors').ApiError)(
        409,
        'not_enough_places',
        'x',
        undefined,
        0,
      ),
    );
    await detail(eventFixture);
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByText('Cette sortie vient de se remplir')).toBeOnTheScreen();
  });

  it('AC-5.3 a full event offers no join', async () => {
    await detail({
      ...eventFixture,
      full: true,
      places: { total: 10, taken: 10, left: 0 },
      viewer: { role: 'member', joined: false, can_join: false, join_blocker: 'full' },
    });
    expect(await screen.findByTestId('join-full-cta')).toBeDisabled();
    expect(screen.getByText("Il n'y a plus de places. Regarde d'autres sorties.")).toBeTruthy();
  });

  it('AC-2.4 a verified-only event asks an unverified member to verify (V0)', async () => {
    await detail({
      ...eventFixture,
      join_rule: 'verified_only',
      viewer: {
        role: 'member',
        joined: false,
        can_join: false,
        join_blocker: 'verification_required',
      },
    });
    expect(await screen.findByText('Réservé aux membres vérifiés')).toBeOnTheScreen();
    expect(screen.getByText('Cette sortie est réservée aux membres vérifiés.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('verify-to-join'));
    expect(
      screen.getByText('Vérifie ton identité pour y participer. Cela prend environ 3 minutes.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('restricted-verify'));
    expect(await screen.findByText('route:verify')).toBeOnTheScreen();
  });

  it('AC-5.7 AC-6.4 joined: status and Ghost, never two primaries; participants listed', async () => {
    await detail(joinedEvent);
    expect(await screen.findByText('Tu y vas · 3 places')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Modifier mes places' })).toBeOnTheScreen();
    expect(screen.queryByTestId('join')).toBeNull();
    expect(screen.getByText('Sofia R.')).toBeOnTheScreen();
    expect(screen.getByText('1 adulte, 2 enfants')).toBeOnTheScreen();
  });

  it('AC-5.2 changes my places within the places left plus mine', async () => {
    mockEvents.changePlaces.mockResolvedValue({ event: joinedEvent });
    await detail(joinedEvent);
    await fireEvent.press(await screen.findByTestId('change-places'));
    // 1 place left + my 3 places = 4 available.
    expect(screen.getByText('3 places sur les 4 restantes')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('adults-plus'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer mes places' }));
    expect(mockEvents.changePlaces).toHaveBeenCalledWith(joinedEvent.id, {
      adults: 2,
      children: 2,
    });
  });

  it('AC-5.4 AC-6.3 leaves after confirming, warned when 3 places or fewer are left', async () => {
    mockEvents.leave.mockResolvedValue(undefined);
    await detail(joinedEvent);
    await fireEvent.press(await screen.findByTestId('leave'));
    expect(
      screen.getByText(
        "Tes places sont libérées tout de suite et tu perdras l'adresse exacte. Quelqu'un d'autre pourrait les prendre.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-leave'));
    expect(mockEvents.leave).toHaveBeenCalledWith(joinedEvent.id);
    expect(await screen.findByText('Tu as quitté la sortie')).toBeOnTheScreen();
  });

  it('BUG-1 after a leave the address and participants disappear at once, even if the refetch fails', async () => {
    mockEvents.leave.mockResolvedValue(undefined);
    await detail(joinedEvent);
    expect(await screen.findByTestId('exact-address')).toBeOnTheScreen();
    mockEvents.get.mockRejectedValue(offlineError());
    await fireEvent.press(screen.getByTestId('leave'));
    await fireEvent.press(screen.getByTestId('confirm-leave'));
    expect(await screen.findByText('Tu as quitté la sortie')).toBeOnTheScreen();
    expect(screen.queryByTestId('exact-address')).toBeNull();
    expect(screen.queryByText(joinedEvent.exact_address!)).toBeNull();
    expect(screen.queryByTestId('going-badge')).toBeNull();
  });

  it('BUG-1 a 404 on refetch purges the cached event (address included)', async () => {
    await detail(joinedEvent);
    expect(await screen.findByTestId('exact-address')).toBeOnTheScreen();
    mockEvents.get.mockRejectedValue(apiError(404, 'not_found'));
    mockEvents.changePlaces.mockRejectedValue(apiError(404, 'not_found'));
    await fireEvent.press(screen.getByTestId('change-places'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByTestId('event-not-found')).toBeOnTheScreen();
    expect(screen.queryByText(joinedEvent.exact_address!)).toBeNull();
  });

  it('BUG-3 a change of places refused because the host cancelled says it is cancelled', async () => {
    await detail(joinedEvent);
    mockEvents.changePlaces.mockRejectedValue(apiError(409, 'event_not_joinable'));
    mockEvents.get.mockResolvedValue({
      event: { ...joinedEvent, status: 'cancelled', exact_address: undefined },
    });
    await fireEvent.press(await screen.findByTestId('change-places'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByTestId('join-cancelled')).toBeOnTheScreen();
    expect(screen.queryByTestId('join-offline')).toBeNull();
  });

  it('BUG-3 a join refused because the event went on hold is not read as "started"', async () => {
    await detail(eventFixture);
    mockEvents.join.mockRejectedValue(apiError(409, 'event_not_joinable'));
    mockEvents.get.mockRejectedValue(apiError(404, 'not_found'));
    await fireEvent.press(await screen.findByTestId('join'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByTestId('event-not-found')).toBeOnTheScreen();
  });

  it('BUG-10 one-sided ages are shown; loading is announced', async () => {
    mockEvents.get.mockReturnValue(new Promise(() => {}));
    await open(`/events/${eventFixture.id}`);
    expect(await screen.findByLabelText('Chargement de la sortie')).toBeOnTheScreen();
  });

  it('BUG-10 shows an age range with only a minimum', async () => {
    await detail({ ...eventFixture, age_min: 6, age_max: null });
    expect(await screen.findByTestId('event-ages')).toHaveTextContent(
      'Conseillé à partir de 6 ans',
    );
  });

  it('AC-8.2 on hold: the participant keeps the booking, only Leave is offered', async () => {
    await detail({ ...joinedEvent, status: 'suspended' });
    expect(await screen.findByText('Cette sortie est en pause')).toBeOnTheScreen();
    expect(screen.getByText('En pause')).toBeOnTheScreen();
    expect(screen.getByText('Tu y vas · 3 places')).toBeOnTheScreen();
    expect(screen.queryByTestId('change-places')).toBeNull();
    expect(screen.getByRole('button', { name: 'Quitter la sortie' })).toBeOnTheScreen();
  });

  it('AC-6.3 AC-7.3 cancelled: no address, a way out', async () => {
    const { exact_address: _gone, ...withoutAddress } = joinedEvent;
    await detail({ ...withoutAddress, status: 'cancelled' });
    expect(await screen.findByText('Cette sortie est annulée')).toBeOnTheScreen();
    expect(screen.queryByTestId('exact-address')).toBeNull();
    expect(screen.getByRole('button', { name: "Voir d'autres sorties" })).toBeOnTheScreen();
  });

  it('AC-1.4 a draft or removed event is not available', async () => {
    mockEvents.get.mockRejectedValue(apiError(404, 'not_found'));
    await open('/events/unknown');
    expect(await screen.findByText("Cette sortie n'est plus disponible")).toBeOnTheScreen();
  });

  it('AC-9.1 AC-9.2 AC-3.11 reports in at most two taps, reason required', async () => {
    mockEvents.report.mockResolvedValue({ report: {} });
    await detail(eventFixture);
    await fireEvent.press(await screen.findByRole('button', { name: "Plus d'options" }));
    await fireEvent.press(screen.getByTestId('report-action'));
    expect(screen.getByTestId('report-send')).toBeDisabled();
    expect(await screen.findByText('Tag inapproprié')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('reason-inappropriate_tag'));
    await fireEvent.changeText(screen.getByTestId('report-details'), 'Le tag ne convient pas.');
    await fireEvent.press(screen.getByTestId('report-send'));
    expect(mockEvents.report).toHaveBeenCalledWith(
      eventFixture.id,
      'inappropriate_tag',
      'Le tag ne convient pas.',
    );
    expect(await screen.findByText('Signalement reçu')).toBeOnTheScreen();
  });

  it('AC-6.5 the host badge opens B1', async () => {
    await detail(eventFixture);
    await fireEvent.press(await screen.findByTestId('host-badge'));
    expect(screen.getByText("J'ai compris")).toBeOnTheScreen();
  });
});

describe('E4 Event detail, host', () => {
  it('AC-5.6 AC-7.1 the host manages: address, participants, edit, no join, no report', async () => {
    await detail({ ...hostedEvent, participants: joinedEvent.participants });
    expect(await screen.findByText('Tu organises cette sortie')).toBeOnTheScreen();
    expect(screen.getByTestId('exact-address')).toBeOnTheScreen();
    expect(screen.getByText('6 places prises sur 10 · 4 restantes')).toBeOnTheScreen();
    expect(screen.getByText('Sofia R.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Modifier la sortie' })).toBeOnTheScreen();
    expect(screen.queryByTestId('join')).toBeNull();
    expect(screen.queryByTestId('more-options')).toBeNull();
  });

  it('AC-7.3 cancels after confirming', async () => {
    mockEvents.cancel.mockResolvedValue({ event: { ...hostedEvent, status: 'cancelled' } });
    await detail({ ...hostedEvent, participants: joinedEvent.participants });
    await fireEvent.press(await screen.findByTestId('host-cancel'));
    expect(screen.getByText('Annuler cette sortie ?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'On prévient par e-mail la personne inscrite. Tu ne pourras pas la remettre en ligne ni changer sa date : tu créeras une nouvelle sortie.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-cancel'));
    expect(mockEvents.cancel).toHaveBeenCalledWith(hostedEvent.id);
    expect(await screen.findByText('Sortie annulée')).toBeOnTheScreen();
    expect(await screen.findByText('Tu as annulé cette sortie')).toBeOnTheScreen();
  });

  it('AC-1.4 AC-1.7 a draft: only me, publish or delete for good', async () => {
    mockEvents.remove.mockResolvedValue(undefined);
    await detail({ ...hostedEvent, status: 'draft' });
    expect(
      await screen.findByText("Pas encore publiée : ce brouillon n'est visible que par toi."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publier ma sortie' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('host-delete'));
    expect(
      screen.getByText('Il est supprimé définitivement. On ne prévient personne.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-delete'));
    expect(mockEvents.remove).toHaveBeenCalledWith(hostedEvent.id);
  });

  it('BUG-8 publishing a draft with missing fields opens the form on them', async () => {
    const partial: SparkEvent = {
      ...hostedEvent,
      status: 'draft',
      category: null,
      area: null,
      places: { total: null, taken: 0, left: 0 },
    };
    mockEvents.publish.mockRejectedValue(
      apiError(422, 'validation_failed', 'x', { category: ['blank'], area: ['blank'] }),
    );
    await detail(partial);
    await fireEvent.press(await screen.findByTestId('host-publish'));
    await fireEvent.press(screen.getByTestId('confirm-publish'));
    expect(await screen.findByTestId('event-form')).toBeOnTheScreen();
    expect(await screen.findByText('Choisis une catégorie.')).toBeOnTheScreen();
  });

  it('AC-1.5 publishing a draft re-checks verification: it stays a draft', async () => {
    mockEvents.publish.mockRejectedValue(apiError(403, 'verification_required'));
    await detail({ ...hostedEvent, status: 'draft' });
    await fireEvent.press(await screen.findByTestId('host-publish'));
    await fireEvent.press(screen.getByTestId('confirm-publish'));
    expect(await screen.findByText('Ta sortie reste en brouillon')).toBeOnTheScreen();
  });

  it('AC-8.2 on hold: the host is asked to verify again', async () => {
    await detail({ ...hostedEvent, status: 'suspended' });
    expect(await screen.findByText('Tes sorties sont en pause')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Vérifier mon identité' })).toBeOnTheScreen();
  });
});

describe('E5 Create / edit', () => {
  it('AC-1.1 a parent who is not verified gets the verify gate, not the form', async () => {
    await open('/events/new', notVerifiedMe);
    expect(await screen.findByText('route:verify')).toBeOnTheScreen();
  });

  it('AC-1.3 nothing is pre-filled; publish waits for the required fields', async () => {
    await open('/events/new');
    expect(await screen.findByTestId('form-address')).toHaveDisplayValue('');
    expect(screen.getByTestId('form-places')).toHaveDisplayValue('');
    expect(screen.getByTestId('rule-anyone')).toBeChecked();
    expect(screen.getByTestId('form-publish')).toBeDisabled();
    expect(screen.getByText(/^Remplis les champs obligatoires pour publier\./)).toBeOnTheScreen();
  });

  /** BUG-5: the native picker (iOS sheet in tests), then "OK". */
  async function pick(testID: string, moment: Date) {
    await fireEvent.press(screen.getByTestId(testID));
    await fireEvent(screen.getByTestId(`${testID}-picker`), 'onChange', {
      nativeEvent: { timestamp: moment.getTime(), utcOffset: 0 },
    });
    await fireEvent.press(screen.getByTestId(`${testID}-done`));
  }

  async function fillForm() {
    await fireEvent.changeText(await screen.findByTestId('form-title'), 'Foot au parc');
    await fireEvent.press(screen.getByTestId('form-category'));
    await fireEvent.press(screen.getByTestId('pick-sport'));
    await pick('form-date', new Date(2026, 9, 10));
    await pick('form-start', new Date(2026, 9, 10, 15, 0));
    await pick('form-end', new Date(2026, 9, 10, 17, 0));
    await fireEvent(screen.getByTestId('form-area'), 'focus');
    await fireEvent.changeText(screen.getByTestId('form-area'), '11');
    await fireEvent.press(await screen.findByTestId('area-suggestion-paris-11'));
    await fireEvent.changeText(screen.getByTestId('form-address'), '12 rue Oberkampf');
    await fireEvent.changeText(screen.getByTestId('form-places'), '10');
  }

  it('AC-1.2 AC-2.2 AC-2.5 publishes after the confirmation sheet', async () => {
    mockEvents.create.mockResolvedValue({ event: hostedEvent });
    mockEvents.get.mockResolvedValue({ event: hostedEvent });
    await open('/events/new');
    await fillForm();
    await fireEvent.press(screen.getByTestId('rule-verified'));
    await fireEvent.press(screen.getByTestId('form-publish'));
    expect(screen.getByText('Publier cette sortie ?')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('publish-summary')).getByText(/réservé aux membres vérifiés/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-publish'));
    expect(mockEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Foot au parc',
        category: 'sport',
        area: 'paris-11',
        places_total: 10,
        join_rule: 'verified_only',
        starts_at: '2026-10-10T13:00:00.000Z',
      }),
      true,
    );
    expect(await screen.findByText('Ta sortie est en ligne')).toBeOnTheScreen();
  });

  it('AC-1.1 saves a draft without publishing', async () => {
    mockEvents.create.mockResolvedValue({ event: { ...hostedEvent, status: 'draft' } });
    mockEvents.get.mockResolvedValue({ event: { ...hostedEvent, status: 'draft' } });
    await open('/events/new');
    await fillForm();
    await fireEvent.press(screen.getByTestId('form-draft'));
    expect(mockEvents.create).toHaveBeenCalledWith(expect.anything(), false);
    expect(await screen.findByText('Brouillon enregistré')).toBeOnTheScreen();
  });

  it('AC-3.8 AC-3.9 adds tags, ignores duplicates, shows refusals', async () => {
    mockEvents.create.mockRejectedValue(
      apiError(422, 'validation_failed', 'x', { tags: ['contains_email'] }),
    );
    await open('/events/new');
    const tags = await screen.findByTestId('form-tags');
    await fireEvent.changeText(tags, '#Parc ');
    expect(screen.getByText('#parc')).toBeOnTheScreen();
    await fireEvent.changeText(tags, 'parc,');
    expect(screen.getByText('Déjà ajouté')).toBeOnTheScreen();
    await fireEvent.changeText(tags, 'a');
    await fireEvent(tags, 'submitEditing');
    expect(screen.getByText('Utilise au moins 2 caractères.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer le tag parc' }));
    expect(screen.queryByText('#parc')).toBeNull();
    await fireEvent.changeText(tags, 'a b c d e ');
    await fireEvent.changeText(tags, 'aa bb cc dd ee ');
    expect(screen.getByText('5 tags maximum.')).toBeOnTheScreen();
    await fillForm();
    await fireEvent.press(screen.getByTestId('form-draft'));
    expect(
      await screen.findByText(
        "Un tag ne peut pas contenir de lien, d'e-mail, de numéro de téléphone, de @pseudo ou d'adresse.",
      ),
    ).toBeOnTheScreen();
  });

  it('AC-1.6 a start in the past is refused on the date field', async () => {
    await open('/events/new');
    await fillForm();
    await pick('form-date', new Date(2026, 9, 1));
    expect(screen.getByTestId('form-publish')).toBeDisabled();
  });

  it('BUG-5 date and times come from labelled native pickers, never typed', async () => {
    await open('/events/new');
    expect(await screen.findByRole('button', { name: 'Date, Choisis un jour' })).toBeOnTheScreen();
    await pick('form-date', new Date(2026, 9, 10));
    expect(screen.getByRole('button', { name: 'Date, Sam. 10 oct.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Début, Choisis une heure' })).toBeOnTheScreen();
  });

  it('BUG-8 saves a draft with only a title, and lists what is still missing to publish', async () => {
    mockEvents.create.mockResolvedValue({ event: { ...hostedEvent, status: 'draft' } });
    mockEvents.get.mockResolvedValue({ event: { ...hostedEvent, status: 'draft' } });
    await open('/events/new');
    await fireEvent.changeText(await screen.findByTestId('form-title'), 'Pique-nique');
    expect(screen.getByTestId('form-missing')).toHaveTextContent(
      /À compléter : Catégorie, Date, Début, Fin, Quartier, Adresse exacte, Places\.$/,
    );
    await fireEvent.press(screen.getByTestId('form-draft'));
    expect(mockEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pique-nique', starts_at: null, area: null }),
      false,
    );
    expect(await screen.findByText('Brouillon enregistré')).toBeOnTheScreen();
  });

  it('BUG-7 a started event can still be edited (the address), without the date check', async () => {
    const started = {
      ...hostedEvent,
      starts_at: '2026-10-06T08:00:00Z',
      ends_at: '2026-10-06T16:00:00Z',
    };
    mockEvents.get.mockResolvedValue({ event: started });
    mockEvents.update.mockResolvedValue({ event: started });
    await open(`/events/${hostedEvent.id}/edit`);
    await fireEvent.changeText(await screen.findByTestId('form-address'), '5 rue Oberkampf');
    expect(screen.getByTestId('form-save')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('form-save'));
    await fireEvent.press(await screen.findByTestId('confirm-notify'));
    expect(mockEvents.update).toHaveBeenCalledWith(
      hostedEvent.id,
      expect.objectContaining({ exact_address: '5 rue Oberkampf' }),
    );
  });

  it('BUG-4 a cancelled event cannot be edited: back to its page with a message', async () => {
    mockEvents.get.mockResolvedValue({ event: { ...hostedEvent, status: 'cancelled' } });
    await open(`/events/${hostedEvent.id}/edit`);
    expect(await screen.findByTestId('event-detail')).toBeOnTheScreen();
    expect(screen.getByText('Cette sortie ne peut plus être modifiée.')).toBeOnTheScreen();
    expect(screen.queryByTestId('event-form')).toBeNull();
  });

  it('BUG-3 an edit refused because the event went on hold says so', async () => {
    mockEvents.get
      .mockResolvedValueOnce({ event: hostedEvent })
      .mockResolvedValue({ event: { ...hostedEvent, status: 'suspended' } });
    mockEvents.update.mockRejectedValue(apiError(409, 'event_not_editable'));
    await open(`/events/${hostedEvent.id}/edit`);
    await fireEvent.changeText(await screen.findByTestId('form-description'), 'Avec goûter');
    await fireEvent.press(screen.getByTestId('form-save'));
    expect(await screen.findByText('Tes sorties sont en pause')).toBeOnTheScreen();
    expect(screen.queryByText('Impossible de joindre SparkCircles')).toBeNull();
  });

  it('AC-2.5 AC-7.2 editing a published event: the rule is fixed, participants are told', async () => {
    mockEvents.get.mockResolvedValue({ event: hostedEvent });
    mockEvents.update.mockResolvedValue({ event: hostedEvent });
    await open(`/events/${hostedEvent.id}/edit`);
    expect(await screen.findByText('Modifier ma sortie')).toBeOnTheScreen();
    expect(screen.getByTestId('rule-verified')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('form-title'), 'Nouveau titre');
    await fireEvent.press(screen.getByTestId('form-save'));
    expect(screen.getByText('Prévenir les personnes inscrites ?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-notify'));
    expect(mockEvents.update).toHaveBeenCalledWith(
      hostedEvent.id,
      expect.not.objectContaining({ join_rule: expect.anything() }),
    );
  });
});

describe('Event language (amendment 2026-10-06)', () => {
  const english: SparkEvent = { ...eventFixture, language: 'en' };

  it('AC-16.1 pre-selects the app language, sends the host choice, shows the helper', async () => {
    mockEvents.create.mockResolvedValue({ event: { ...hostedEvent, status: 'draft' } });
    mockEvents.get.mockResolvedValue({ event: { ...hostedEvent, status: 'draft' } });
    await open('/events/new');
    expect(await screen.findByText('Langue de la sortie')).toBeOnTheScreen();
    expect(
      screen.getByText("Les autres verront ta sortie telle que tu l'écris."),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('language-fr')).toBeSelected();
    await fireEvent.changeText(screen.getByTestId('form-title'), 'Picnic in the park');
    await fireEvent.press(screen.getByTestId('language-en'));
    await fireEvent.press(screen.getByTestId('form-draft'));
    expect(mockEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      false,
    );
  });

  it('AC-16.1 an English app pre-selects English', async () => {
    await i18n.changeLanguage('en');
    await open('/events/new');
    expect(await screen.findByText('Event language')).toBeOnTheScreen();
    expect(screen.getByTestId('language-en')).toBeSelected();
  });

  it('AC-16.2 tags an English event « En anglais » on the card and the detail, with a label', async () => {
    mockEvents.search.mockResolvedValue(eventPage([english]));
    mockEvents.get.mockResolvedValue({ event: english });
    await open('/');
    const tag = await screen.findByTestId(`event-card-language-${english.id}`);
    expect(tag).toHaveTextContent('En anglais');
    expect(screen.getByTestId(`event-card-${english.id}`).props.accessibilityLabel).toMatch(
      /Sortie en anglais/,
    );
    await open(`/events/${english.id}`);
    expect(await screen.findByLabelText('Sortie en anglais')).toBeOnTheScreen();
  });

  it('AC-16.2 shows nothing when the languages match; "In French" for an English app', async () => {
    mockEvents.search.mockResolvedValue(eventPage([eventFixture]));
    await open('/');
    await screen.findByText('Goûter et jeux au parc');
    expect(screen.queryByTestId(`event-card-language-${eventFixture.id}`)).toBeNull();
    await i18n.changeLanguage('en');
    await open('/');
    expect(await screen.findByTestId(`event-card-language-${eventFixture.id}`)).toHaveTextContent(
      'In French',
    );
    expect(screen.getByLabelText('Event in French')).toBeOnTheScreen();
  });

  it('AC-16.3 filters by language from Filtres; "Toutes" is the default', async () => {
    await open('/');
    await fireEvent.press(await screen.findByTestId('filters-button'));
    expect(screen.getByText('Langue')).toBeOnTheScreen();
    expect(screen.getByTestId('language-all')).toBeSelected();
    await fireEvent.press(screen.getByTestId('language-en'));
    await fireEvent.press(screen.getByTestId('filters-apply'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'en' }),
        1,
        expect.anything(),
      ),
    );
  });

  it('AC-16.4 shows the title and description as written, untranslated', async () => {
    mockEvents.get.mockResolvedValue({ event: english });
    await open(`/events/${english.id}`);
    expect(await screen.findByText(english.title!)).toBeOnTheScreen();
    expect(screen.getByText(english.description!)).toBeOnTheScreen();
  });
});

describe('French copy (polish 2026-10)', () => {
  it('the events copy is gender-neutral (no organisateur, toi seul, participant prévenu or « , vérifié »)', () => {
    const eventsCopy = JSON.stringify(i18n.getResourceBundle('fr', 'translation').events);
    expect(eventsCopy).not.toMatch(
      /organisateur|toi seul|[Pp]articipants? (est|sont)|(est|sont|été) prévenu\b|\b[Tt]u es (inscrit|invité|vérifié)|vérifié de nouveau|Adulte accompagnant|, vérifié"/,
    );
    expect(i18n.t('events.detail.deleteBody', { lng: 'fr' })).toBe(
      'Il est supprimé définitivement. On ne prévient personne.',
    );
  });
});
