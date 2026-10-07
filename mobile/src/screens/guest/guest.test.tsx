import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { eventSearchKey } from '../../api/events';
import { ME_KEY } from '../../auth/useMe';
import { consumeReturnTo, rememberFilters, returnHref } from '../../auth/returnTo';
import i18n from '../../i18n';
import CommunityTab from '../../app/(tabs)/community';
import MarketTab from '../../app/(tabs)/market';
import MySpaceTab from '../../app/(tabs)/my-space';
import TravelTab from '../../app/(tabs)/travel';
import { apiError, mockEvents, offlineError, resetApiMock } from '../../test/apiMock';
import {
  eventFixture,
  eventOptionsFixture,
  eventPage,
  guestEvent,
  guestLockedEvent,
} from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { AREA_KEY } from '../events/areaStore';
import { EventDetailScreen } from '../events/EventDetailScreen';
import { EventsScreen } from '../events/EventsScreen';
import { HERO_SEEN_KEY } from './heroStore';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const ROUTES = {
  index: EventsScreen,
  community: CommunityTab,
  market: MarketTab,
  travel: TravelTab,
  'my-space': MySpaceTab,
  'events/[id]/index': EventDetailScreen,
  'sign-up': routeStub('sign-up'),
  'log-in': routeStub('log-in'),
  verify: routeStub('verify'),
};

const PROMISE = 'Les sorties en famille, sans la charge mentale.';
const secureStore = SecureStore as unknown as { __reset: () => void };

async function openAsGuest(url: string) {
  return renderScreen(ROUTES, { url, gate: 'signedOut' });
}

async function openAsMember(url: string) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, meFixture);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

beforeEach(async () => {
  resetApiMock();
  secureStore.__reset();
  consumeReturnTo(); // nothing left over from another test
  rememberFilters(null);
  mockEvents.options.mockResolvedValue(eventOptionsFixture);
  mockEvents.search.mockResolvedValue(eventPage([guestEvent, guestLockedEvent]));
  mockEvents.get.mockResolvedValue({ event: guestEvent });
  mockEvents.mine.mockResolvedValue(eventPage([]));
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

describe('US-15 guest home (Sorties in guest mode)', () => {
  it('AC-15.1 explains SparkCircles, offers sign-up and log-in, and shows real events at once', async () => {
    await openAsGuest('/');
    expect(await screen.findByRole('header', { name: PROMISE })).toBeOnTheScreen();
    expect(screen.getByTestId('guest-hero')).toBeOnTheScreen();
    expect(screen.getByText('Trouve une sortie près de chez toi')).toBeOnTheScreen();
    expect(screen.getByText('Les parents qui organisent sont vérifiés')).toBeOnTheScreen();
    expect(screen.getByText('Moins à organiser, à plusieurs')).toBeOnTheScreen();
    expect(screen.getByText('Bientôt')).toBeOnTheScreen();
    expect(
      screen.getByText('Pas besoin de compte pour regarder les sorties ci-dessous.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('hero-sign-up')).toHaveTextContent('Créer mon compte');
    expect(screen.getByTestId('hero-log-in')).toHaveTextContent("J'ai déjà un compte");
    expect(screen.getByText('Me connecter')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Trouve une sortie' })).toBeOnTheScreen();
    expect(await screen.findByText('Goûter et jeux au parc')).toBeOnTheScreen();
    expect(screen.getByText("Envie d'en rejoindre une ?")).toBeOnTheScreen();
    expect(screen.getByText('Confidentialité')).toBeOnTheScreen();
    expect(screen.getByText('English')).toBeOnTheScreen();
  });

  it('AC-15.1b hides "Mes sorties" and the map button; « Créer ma sortie » asks for an account (AC-15.5)', async () => {
    await openAsGuest('/');
    await screen.findByText('Goûter et jeux au parc');
    expect(screen.queryByText('Mes sorties')).toBeNull();
    expect(screen.queryByTestId('map-button')).toBeNull();
    // Guest buttons harmonisation: a quiet link with a `plus` icon, not the Secondary pill.
    const create = screen.getByRole('button', { name: 'Créer ma sortie' });
    expect(create).toHaveStyle({ minHeight: 44 });
    expect(create.props.className).not.toContain('rounded-pill');
    expect(screen.getByText('Créer ma sortie').props.className).toContain('text-green-dark');
    await fireEvent.press(screen.getByTestId('create-event'));
    expect(screen.getByText('Crée ton compte pour proposer une sortie')).toBeOnTheScreen();
    // No event behind "create": no return-to-event promise.
    expect(screen.queryByTestId('return-promise')).toBeNull();
    // QA guest-home BUG-3: back to the create form (V0 replaces it until verified).
    await fireEvent.press(screen.getByTestId('guest-sheet-sign-up'));
    expect(await screen.findByText('route:sign-up')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe('/events/new');
  });

  it('the footer « Français · English » links change the app language', async () => {
    await openAsGuest('/');
    await fireEvent.press(await screen.findByTestId('footer-en'));
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(await screen.findByText('Privacy')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('footer-fr'));
    await waitFor(() => expect(i18n.language).toBe('fr'));
    expect(await screen.findByText('Confidentialité')).toBeOnTheScreen();
  });

  it('AC-15.1 shows the compact hero once this device has seen the full one (flag on the device)', async () => {
    await openAsGuest('/');
    await screen.findByTestId('guest-hero');
    await waitFor(async () => expect(await SecureStore.getItemAsync(HERO_SEEN_KEY)).toBe('1'));

    await openAsGuest('/');
    expect(await screen.findByTestId('guest-hero-compact')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: PROMISE })).toBeOnTheScreen();
    expect(screen.queryByText('Moins à organiser, à plusieurs')).toBeNull();
    expect(
      screen.queryByText('Pas besoin de compte pour regarder les sorties ci-dessous.'),
    ).toBeNull();
    // Guest buttons harmonisation: stacked full width (large Primary, then Ghost), never inline.
    const actions = screen.getByTestId('hero-compact-actions');
    expect(actions.props.className).toContain('gap-sm');
    expect(actions.props.className).not.toContain('flex-row');
    const signUp = within(actions).getByTestId('hero-sign-up');
    const logIn = within(actions).getByTestId('hero-log-in');
    expect(signUp.props.className).toContain('px-7 py-3.5');
    expect(logIn.props.className).toContain('px-5 py-2.5');
    expect(signUp.parent?.props.className ?? '').not.toContain('flex-1');
    expect(logIn.parent?.props.className ?? '').not.toContain('flex-1');
  });

  it('AC-15.9 AC-15.12 searches "Tout Paris" by default, sent as the city area', async () => {
    await openAsGuest('/');
    await screen.findByText('Goûter et jeux au parc');
    expect(mockEvents.search).toHaveBeenCalledWith({ area: ['paris'] }, 1, expect.anything());
    expect(screen.getByTestId('area-selector')).toHaveTextContent('Tout Paris');
    await fireEvent.press(screen.getByTestId('area-selector'));
    expect(screen.getByText('Choisis ta zone')).toBeOnTheScreen();
    expect(screen.getByText('Ton choix reste sur ce téléphone.')).toBeOnTheScreen();
    expect(screen.queryByText(/ma position/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('area-paris-11'));
    await fireEvent.press(screen.getByTestId('area-use'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        { area: ['paris-11'] },
        1,
        expect.anything(),
      ),
    );
    expect(await SecureStore.getItemAsync(AREA_KEY)).toBe('paris-11');
  });

  it('AC-15.3 uses the same filters as members (category, date, Filtres)', async () => {
    await openAsGuest('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.press(screen.getByTestId('category-sport'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ area: ['paris'], category: ['sport'] }),
        1,
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('filters-button')).toBeOnTheScreen();
    expect(screen.getByTestId('date-weekend')).toBeOnTheScreen();
  });
});

describe('US-15 guest cards', () => {
  it('AC-15.2 AC-15.11 shows only « Organisée par un parent vérifié », never a name or avatar', async () => {
    await openAsGuest('/');
    const card = await screen.findByTestId(`event-card-${guestEvent.id}`);
    expect(within(card).getByText('Organisée par un parent vérifié')).toBeOnTheScreen();
    expect(within(card).getByText('Vérifié ✓')).toBeOnTheScreen();
    expect(within(card).queryByText(/Camille/)).toBeNull();
    expect(within(card).queryByText('Ancien membre')).toBeNull();
    expect(card.props.accessibilityLabel).toMatch(/Organisée par un parent vérifié/);
    expect(card.props.accessibilityLabel).not.toMatch(/organisée par (?!un parent)/);
  });

  it('AC-15.4 a verified-only event: the lock badge, no host information at all, the locked CTA', async () => {
    await openAsGuest('/');
    const card = await screen.findByTestId(`event-card-${guestLockedEvent.id}`);
    expect(within(card).getByText('Réservée aux parents vérifiés')).toBeOnTheScreen();
    expect(
      within(card).getByText('Crée ton compte et fais-toi vérifier pour participer'),
    ).toBeOnTheScreen();
    expect(within(card).queryByText('Organisée par un parent vérifié')).toBeNull();
    expect(within(card).queryByText('Vérifié ✓')).toBeNull();
    // The places line keeps its own badge (almost full).
    expect(within(card).getByText('Presque complet')).toBeOnTheScreen();
  });

  it('AC-15.14 explains « vérifié » without an account, from a card badge and the hero link', async () => {
    await openAsGuest('/');
    await fireEvent.press(await screen.findByTestId(`event-card-badge-${guestEvent.id}`));
    expect(screen.getByText('Identité contrôlée par SparkCircles')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Nous avons contrôlé une pièce d'identité officielle et un selfie de chaque parent qui organise.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Leur nom et leur visage correspondent à une pièce d'identité officielle"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Ce n'est pas une vérification du casier judiciaire"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('got-it'));
    await fireEvent.press(screen.getByTestId('hero-verified-link'));
    expect(screen.getByText('Identité contrôlée par SparkCircles')).toBeOnTheScreen();
  });
});

describe('US-15 guest states', () => {
  it('AC-15.12 loading: skeletons and « On cherche les sorties… », the hero shows at once', async () => {
    mockEvents.search.mockReturnValue(new Promise(() => undefined));
    await openAsGuest('/');
    expect(await screen.findByText('On cherche les sorties…')).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: PROMISE })).toBeOnTheScreen();
  });

  it('AC-15.12 empty area: « Pas encore de sortie dans cette zone » and « Voir tout Paris »', async () => {
    await SecureStore.setItemAsync(AREA_KEY, 'paris-20');
    mockEvents.search.mockResolvedValue(eventPage([]));
    await openAsGuest('/');
    expect(await screen.findByText('Pas encore de sortie dans cette zone')).toBeOnTheScreen();
    expect(screen.getByTestId('empty-sign-up')).toHaveTextContent('Créer mon compte');
    await fireEvent.press(screen.getByText('Voir tout Paris'));
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith({ area: ['paris'] }, 1, expect.anything()),
    );
  });

  it('AC-15.12 empty "Tout Paris": « Choisir une autre zone »; with filters: « Effacer les filtres »', async () => {
    mockEvents.search.mockResolvedValue(eventPage([]));
    await openAsGuest('/');
    expect(await screen.findByText('Choisir une autre zone')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('category-sport'));
    expect(await screen.findByText('Effacer les filtres')).toBeOnTheScreen();
  });

  it('offline with results: the yellow note, the last results and the sign-up buttons stay', async () => {
    mockEvents.search.mockRejectedValue(offlineError());
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(['events', 'search'], { staleTime: 0 });
    // Results from the last visit, stale: the refetch fails offline.
    queryClient.setQueryData(
      eventSearchKey({ area: ['paris'] }),
      { pages: [eventPage([guestEvent])], pageParams: [1] },
      { updatedAt: 0 },
    );
    await renderScreen(ROUTES, { url: '/', gate: 'signedOut', queryClient });
    expect(await screen.findByText("Tu n'as pas de connexion")).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ces sorties datent de ta dernière visite. Reconnecte-toi pour les mettre à jour.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Goûter et jeux au parc')).toBeOnTheScreen();
    expect(screen.getByTestId('hero-sign-up')).toBeOnTheScreen();
  });

  it('offline with nothing cached: « Pas de connexion, rien de plus à afficher » and « Réessayer »', async () => {
    mockEvents.search.mockRejectedValue(offlineError());
    await openAsGuest('/');
    expect(await screen.findByText('Pas de connexion, rien de plus à afficher')).toBeOnTheScreen();
    expect(screen.getByTestId('events-retry')).toHaveTextContent('Réessayer');
  });

  it('AC-15.12 rate-limited, or a blocked connection: « Beaucoup de recherches d’un coup »', async () => {
    mockEvents.search.mockRejectedValue(apiError(429, 'rate_limited'));
    await openAsGuest('/');
    expect(await screen.findByText("Beaucoup de recherches d'un coup")).toBeOnTheScreen();
    expect(screen.getByText('Attends une minute, puis relance ta recherche.')).toBeOnTheScreen();

    mockEvents.search.mockRejectedValue(apiError(403, 'client_blocked'));
    await openAsGuest('/');
    expect(await screen.findByTestId('events-rate-limited')).toBeOnTheScreen();
    // QA guest-home BUG-4: the block lasts an hour, so no "wait a minute".
    expect(screen.getByText('Réessaie un peu plus tard.')).toBeOnTheScreen();
    expect(screen.queryByText('Attends une minute, puis relance ta recherche.')).toBeNull();
  });

  it('load failure (also a refused client): « On n’a pas pu charger les sorties » with « Réessayer »', async () => {
    mockEvents.search.mockRejectedValue(apiError(403, 'client_not_allowed'));
    await openAsGuest('/');
    expect(await screen.findByText("On n'a pas pu charger les sorties")).toBeOnTheScreen();
    expect(screen.getByText('Réessaie dans un instant.')).toBeOnTheScreen();
    mockEvents.search.mockResolvedValue(eventPage([guestEvent]));
    await fireEvent.press(screen.getByTestId('events-retry'));
    expect(await screen.findByText('Goûter et jeux au parc')).toBeOnTheScreen();
  });
});

describe('US-15 guest event detail and the sign-up prompt', () => {
  it('AC-15.2 AC-15.11 shows the guest view: description, coarse area, places; no host identity, participants or address', async () => {
    await openAsGuest(`/events/${guestEvent.id}`);
    expect(await screen.findByRole('header', { name: guestEvent.title! })).toBeOnTheScreen();
    expect(screen.getByText(guestEvent.description!)).toBeOnTheScreen();
    expect(screen.getByText('Paris 11e')).toBeOnTheScreen();
    expect(screen.getByText('Plus que 4 places sur 10')).toBeOnTheScreen();
    expect(screen.getByText('Organisée par un parent vérifié')).toBeOnTheScreen();
    expect(screen.queryByTestId('host-card')).toBeNull();
    expect(screen.queryByTestId('participant-row')).toBeNull();
    expect(screen.queryByTestId('exact-address')).toBeNull();
    expect(screen.queryByText('Ancien membre')).toBeNull();
  });

  it('AC-15.5 AC-15.7 "Rejoindre" opens the prompt with the return promise; sign-up remembers the event', async () => {
    await openAsGuest(`/events/${guestEvent.id}`);
    await fireEvent.press(await screen.findByTestId('guest-join'));
    expect(screen.getByText('Crée ton compte pour rejoindre cette sortie')).toBeOnTheScreen();
    expect(screen.getByText('Avec un compte, tu pourras')).toBeOnTheScreen();
    expect(
      screen.getByText('Après ton inscription, tu reviens sur cette sortie.'),
    ).toBeOnTheScreen();
    expect(screen.getByText("Ta place est prête : c'est toi qui confirmes.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('guest-sheet-sign-up'));
    expect(await screen.findByText('route:sign-up')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe(`/events/${guestEvent.id}?then=join`);
  });

  it('AC-15.8 a verified-only event: the sign-up-and-verify prompt, back to the event to verify', async () => {
    mockEvents.get.mockResolvedValue({ event: guestLockedEvent });
    await openAsGuest(`/events/${guestLockedEvent.id}`);
    expect(await screen.findByText('Réservée aux parents vérifiés')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('guest-join'));
    expect(
      screen.getByText('Crée ton compte et fais-toi vérifier pour rejoindre'),
    ).toBeOnTheScreen();
    expect(screen.getByText("Ensuite, on t'explique comment te faire vérifier.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('guest-sheet-log-in'));
    expect(await screen.findByText('route:log-in')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe(`/events/${guestLockedEvent.id}?then=verify`);
  });

  it('AC-15.5 reporting asks for an account', async () => {
    await openAsGuest(`/events/${guestEvent.id}`);
    await fireEvent.press(await screen.findByTestId('more-options'));
    expect(screen.getByText('Crée ton compte pour signaler cette sortie')).toBeOnTheScreen();
    expect(screen.queryByText('Lieu dangereux')).toBeNull();
    // QA guest-home BUG-2: the return target remembers the report.
    await fireEvent.press(screen.getByTestId('guest-sheet-log-in'));
    expect(await screen.findByText('route:log-in')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe(`/events/${guestEvent.id}?then=report`);
  });

  it('AC-15.7 back as a member after « Signaler »: the report sheet, not the join sheet', async () => {
    mockEvents.get.mockResolvedValue({ event: eventFixture });
    await openAsMember(`/events/${eventFixture.id}?then=report`);
    expect(await screen.findByTestId('report-sheet')).toBeVisible();
    expect(screen.queryByText('Combien de places ?')).toBeNull();
  });

  it('AC-15.7 back as a member after the wishlist heart: just the event, no sheet', async () => {
    mockEvents.get.mockResolvedValue({ event: eventFixture });
    await openAsMember(`/events/${eventFixture.id}?then=wishlist`);
    expect(await screen.findByRole('header', { name: eventFixture.title! })).toBeOnTheScreen();
    expect(screen.queryByText('Combien de places ?')).toBeNull();
    expect(screen.queryByTestId('report-sheet')).not.toBeVisible();
  });

  it('AC-15.7 back as a member, the join is ready but not done (the join sheet is open)', async () => {
    mockEvents.get.mockResolvedValue({ event: eventFixture });
    await openAsMember(`/events/${eventFixture.id}?then=join`);
    expect(await screen.findByText('Combien de places ?')).toBeOnTheScreen();
    expect(mockEvents.join).not.toHaveBeenCalled();
  });

  it('AC-15.8 back as an unverified member on a verified-only event: the invitation to verify', async () => {
    mockEvents.get.mockResolvedValue({
      event: {
        ...eventFixture,
        join_rule: 'verified_only',
        viewer: {
          role: 'member',
          joined: false,
          can_join: false,
          join_blocker: 'verification_required',
        },
      },
    });
    await openAsMember(`/events/${eventFixture.id}?then=verify`);
    expect(
      await screen.findByText(
        'Vérifie ton identité pour y participer. Cela prend environ 3 minutes.',
      ),
    ).toBeOnTheScreen();
  });

  it('AC-15.7 the Sorties filters come back after the account step', async () => {
    await openAsGuest('/');
    await screen.findByText('Goûter et jeux au parc');
    await fireEvent.press(screen.getByTestId('category-sport'));
    await fireEvent.press(screen.getByTestId('hero-sign-up'));
    expect(await screen.findByText('route:sign-up')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe('/');

    await openAsMember('/');
    await waitFor(() =>
      expect(mockEvents.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: ['sport'] }),
        1,
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('category-sport')).toBeSelected();
  });
});

describe('US-15 guest tabs', () => {
  it('AC-8.1 (circles) /community explains circles without « Bientôt », with the circle search', async () => {
    await openAsGuest('/community');
    expect(await screen.findByRole('header', { name: 'Cercles' })).toBeOnTheScreen();
    expect(screen.getByText('Des petits cercles de familles près de chez toi')).toBeOnTheScreen();
    expect(screen.queryByText('Bientôt')).toBeNull();
    expect(screen.getByTestId('guest-tab-sign-up')).toHaveTextContent('Créer mon compte');
    expect(screen.getByTestId('circles-segment-find')).toBeOnTheScreen();
  });

  it.each([
    ['/market', 'Services', 'Des aides de confiance pour la garde et le quotidien'],
    ['/travel', 'Voyages', 'Échange ta maison avec une famille pendant les vacances'],
  ])(
    'AC-15.6 %s explains the module, « Bientôt », and invites to sign up',
    async (url, name, title) => {
      await openAsGuest(url);
      expect(await screen.findByRole('header', { name })).toBeOnTheScreen();
      expect(screen.getByText(title)).toBeOnTheScreen();
      expect(screen.getByText('Bientôt')).toBeOnTheScreen();
      expect(screen.getByTestId('guest-tab-sign-up')).toHaveTextContent('Créer mon compte');
      expect(screen.getByText("J'ai déjà un compte")).toBeOnTheScreen();
      expect(screen.getByText('Voir les sorties')).toBeOnTheScreen();
    },
  );

  it('AC-15.5 AC-15.6 Mon espace: the explanation, no « Bientôt », sign-up comes back to it', async () => {
    await openAsGuest('/my-space');
    expect(await screen.findByRole('header', { name: 'Mon espace' })).toBeOnTheScreen();
    expect(
      screen.getByText('Tout ce qui compte pour ta famille, au même endroit'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Bientôt')).toBeNull();
    expect(screen.queryByTestId('account-entry')).toBeNull();
    await fireEvent.press(screen.getByTestId('guest-tab-sign-up'));
    expect(await screen.findByText('route:sign-up')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe('/my-space');
  });
});
