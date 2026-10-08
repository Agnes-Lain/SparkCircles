import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';

import type { RequestList, SparkEvent } from '../../api/events';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { apiError, mockAuth, mockEvents, resetApiMock } from '../../test/apiMock';
import {
  acceptedDropoffEvent,
  dropoffEvent,
  eventOptionsFixture,
  eventPage,
  guestLockedEvent,
  hostedDropoffEvent,
  pendingDropoffEvent,
} from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { EventDetailScreen } from './EventDetailScreen';
import { EventFormScreen } from './EventFormScreen';
import { EMPTY_FORM, toParams, validateForm, withAdultRequired } from './formModel';
import { displayPhone, normalizePhone } from './phone';
import { withinPhoneWindow, withoutPhones } from './queries';
import { allFit, RequestsScreen } from './RequestsScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const ROUTES = {
  index: routeStub('index'),
  'events/[id]/index': EventDetailScreen,
  'events/[id]/edit': EventFormScreen,
  'events/[id]/requests': RequestsScreen,
  'events/new': EventFormScreen,
  verify: routeStub('verify'),
};

async function open(url: string, token: string | null = 'jwt') {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, meFixture);
  return renderScreen(ROUTES, { url, token, gate: token ? 'ready' : 'signedOut', queryClient });
}

const secureStore = SecureStore as unknown as { __reset: () => void };

beforeEach(async () => {
  resetApiMock();
  secureStore.__reset();
  mockAuth.me.mockResolvedValue(meFixture);
  mockEvents.options.mockResolvedValue(eventOptionsFixture);
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
  jest.setSystemTime(new Date('2026-10-09T10:00:00Z'));
  await i18n.changeLanguage('fr');
});

afterEach(() => jest.useRealTimers());

// Expo Router's test store keeps a screen mounted for a URL it saw before: one id per test.
let eid = '';
let serial = 0;
const show = (event: SparkEvent) => {
  serial += 1;
  eid = `${event.id.slice(0, -4)}${String(serial).padStart(4, '0')}`;
  mockEvents.get.mockResolvedValue({ event: { ...event, id: eid } });
};

describe('US-17 phone numbers and form rules', () => {
  it('AC-17.11 accepts French and EU numbers, refuses the rest', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('+49 30 1234567')).toBe('+49301234567');
    expect(normalizePhone('+1 415 555 0100')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(displayPhone('+33612345678')).toBe('06 12 34 56 78');
  });

  it('AC-17.8 "Facultatif" presets approval, a hand choice is kept', () => {
    const dropoff = withAdultRequired(EMPTY_FORM, false);
    expect(dropoff.approvalRequired).toBe(true);
    const chosen = withAdultRequired(
      { ...dropoff, approvalRequired: false, approvalChosen: true },
      true,
    );
    expect(withAdultRequired(chosen, false).approvalRequired).toBe(false);
  });

  it('AC-17.4 a drop-off event needs the age range and a valid host phone', () => {
    const values = { ...withAdultRequired(EMPTY_FORM, false), hostPhone: '123' };
    const errors = validateForm(values, i18n.t);
    expect(errors.age).toBe(
      'Indique la tranche d’âge des enfants que tu peux accueillir.'.replace('’', "'"),
    );
    expect(errors.phone).toMatch(/^Entre un numéro français/);
    expect(validateForm({ ...values, hostPhone: '' }, i18n.t).phone).toBe(
      'Ajoute ton numéro de téléphone.',
    );
  });

  it('AC-17.3 a drop-off event is sent as verified members only, with its settings', () => {
    const values = {
      ...withAdultRequired(EMPTY_FORM, false),
      joinRule: 'anyone' as const,
      hostPhone: '06 12 34 56 78',
    };
    expect(toParams(values, { includeRule: true })).toMatchObject({
      join_rule: 'verified_only',
      adult_required: false,
      approval_required: true,
      host_phone: '+33612345678',
    });
    expect(
      toParams({ ...values, adultRequired: true }, { includeRule: true }).host_phone,
    ).toBeNull();
  });

  it('AC-17.12 lists never keep phones; the detail drops them after the window', () => {
    expect(withoutPhones(acceptedDropoffEvent).host_phone).toBeUndefined();
    expect(withoutPhones(hostedDropoffEvent).participants?.[0]).not.toHaveProperty(
      'emergency_phone',
    );
    const later = new Date('2026-10-12T00:00:00Z');
    expect(withinPhoneWindow(acceptedDropoffEvent, later).host_phone).toBeUndefined();
    expect(withinPhoneWindow(hostedDropoffEvent, later).host_phone).toBe('+33612345678');
    expect(withinPhoneWindow(acceptedDropoffEvent).host_phone).toBe('+33612345678');
  });
});

describe('US-17 create form', () => {
  it('AC-17.1, AC-17.3 "Facultatif" reveals the notice, the locked rule, the age and the phone', async () => {
    await open('/events/new');
    expect(await screen.findByText("Présence d'un adulte")).toBeOnTheScreen();
    expect(screen.queryByTestId('form-host-phone')).toBeNull();
    await fireEvent.press(screen.getByTestId('adult-optional'));
    expect(screen.getByText('Sortie avec dépôt d’enfants'.replace('’', "'"))).toBeOnTheScreen();
    expect(screen.getByTestId('form-locked-rule')).toBeOnTheScreen();
    expect(screen.queryByTestId('rule-anyone')).toBeNull();
    expect(screen.getByText('Âge conseillé (obligatoire)')).toBeOnTheScreen();
    expect(screen.getByTestId('form-host-phone')).toBeOnTheScreen();
    expect(screen.getByTestId('approval-manual')).toBeSelected();
  });
});

describe('US-17 detail', () => {
  it('AC-17.5, AC-17.24 a guest sees the notice before the locked CTA, no request state', async () => {
    show({ ...guestLockedEvent, adult_required: false, approval_required: true });
    await open(`/events/${eid}`, null);
    expect(await screen.findByTestId('detail-dropoff-notice')).toBeOnTheScreen();
    expect(screen.getByText('Créer un compte pour rejoindre')).toBeOnTheScreen();
    expect(
      screen.getByText('Seuls les membres vérifiés peuvent rejoindre cette sortie.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('request-pending')).toBeNull();
  });

  it('AC-17.14 with approval the CTA sends a request, with the 48 h caption', async () => {
    show(dropoffEvent);
    await open(`/events/${eid}`);
    expect(await screen.findByText('Envoyer ma demande')).toBeOnTheScreen();
    expect(screen.getByText(/La personne qui organise répond sous 48 h au plus/)).toBeOnTheScreen();
    expect(screen.getByTestId('detail-on-request')).toBeOnTheScreen();
  });

  it('AC-17.14 pending: the note, the badge, and "Retirer ma demande" without confirmation', async () => {
    show(pendingDropoffEvent);
    mockEvents.leave.mockResolvedValue(undefined);
    await open(`/events/${eid}`);
    expect(await screen.findByTestId('request-pending')).toHaveTextContent(
      /Sans réponse d'ici sam\. 10 oct\., 15 h, la demande expire\./,
    );
    expect(screen.getByText('Demande envoyée · 3 places')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('withdraw-request'));
    await waitFor(() => expect(mockEvents.leave).toHaveBeenCalledWith(eid));
  });

  it('AC-17.16 declined: neutral, no new request, "Voir d’autres sorties"', async () => {
    show({
      ...pendingDropoffEvent,
      viewer: {
        ...pendingDropoffEvent.viewer,
        join_blocker: 'declined',
        request: { ...pendingDropoffEvent.viewer.request!, status: 'declined' },
      },
    });
    await open(`/events/${eid}`);
    expect(await screen.findByTestId('request-declined')).toBeOnTheScreen();
    expect(screen.getByTestId('declined-see-others')).toBeOnTheScreen();
    expect(screen.queryByText('Envoyer ma demande')).toBeNull();
  });

  it('AC-17.19 expired: the parent can send a new request', async () => {
    show({
      ...dropoffEvent,
      viewer: {
        ...dropoffEvent.viewer,
        request: { ...pendingDropoffEvent.viewer.request!, status: 'expired' },
      },
    });
    await open(`/events/${eid}`);
    expect(await screen.findByTestId('request-expired')).toBeOnTheScreen();
    expect(screen.getByText('Envoyer une nouvelle demande')).toBeOnTheScreen();
  });

  it('AC-17.9 accepted: the host phone as a tap-to-call link under the address', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    show(acceptedDropoffEvent);
    await open(`/events/${eid}`);
    const link = await screen.findByRole('link', {
      name: 'Appeler la personne qui organise, 06 12 34 56 78',
    });
    await fireEvent.press(link);
    expect(openURL).toHaveBeenCalledWith('tel:+33612345678');
  });

  it('AC-17.12 the host phone is gone 24 h after the end', async () => {
    jest.setSystemTime(new Date('2026-10-11T16:00:00Z'));
    show(acceptedDropoffEvent);
    await open(`/events/${eid}`);
    expect(await screen.findByTestId('host-phone-gone')).toBeOnTheScreen();
    expect(screen.queryByTestId('host-phone-link')).toBeNull();
  });

  it('AC-17.15, AC-17.10 the host sees the requests waiting and the emergency phone', async () => {
    show(hostedDropoffEvent);
    await open(`/events/${eid}`);
    expect(await screen.findByText('3 demandes en attente')).toBeOnTheScreen();
    expect(screen.getByText('À traiter')).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: "Appeler le numéro d'urgence, 06 98 76 54 32" }),
    ).toBeOnTheScreen();
  });
});

describe('US-17 join sheet', () => {
  it('AC-17.2, AC-17.6, AC-17.7 drop-off: 0 adults, emergency phone, the box enables the CTA', async () => {
    show(dropoffEvent);
    mockEvents.join.mockResolvedValue({ event: pendingDropoffEvent });
    await open(`/events/${eid}`);
    await fireEvent.press(await screen.findByTestId('join'));
    expect(await screen.findByTestId('join-dropoff-line')).toBeOnTheScreen();
    expect(screen.getByText('0 ou plus')).toBeOnTheScreen();
    expect(screen.getByTestId('join-confirm')).toBeDisabled();
    expect(screen.getByText('Coche la case pour continuer.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: "Moins d'adultes" }));
    await fireEvent.press(screen.getByTestId('acknowledge'));
    await fireEvent.press(screen.getByTestId('join-confirm'));
    expect(await screen.findByText('Ajoute un numéro joignable.')).toBeOnTheScreen();
    expect(mockEvents.join).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('emergency-phone'), '06 98 76 54 32');
    await fireEvent.press(screen.getByTestId('join-confirm'));
    await waitFor(() =>
      expect(mockEvents.join).toHaveBeenCalledWith(eid, {
        adults: 0,
        children: 1,
        emergency_phone: '+33698765432',
        responsibility_acknowledged: true,
      }),
    );
  });
});

describe('US-17 host request list', () => {
  const list = (overrides: Partial<RequestList> = {}): RequestList => ({
    places_left: 6,
    frozen: false,
    requests: [
      {
        id: 'r1',
        first_name: 'Sofia',
        last_name_initial: 'R',
        verified: true,
        former_member: false,
        extra: false,
        adults: 0,
        children: 2,
        places: 2,
        current_places: 0,
        requested_at: '2026-10-09T08:00:00Z',
        expires_at: '2026-10-10T13:00:00Z',
      },
      {
        id: 'r2',
        first_name: 'Karim',
        last_name_initial: 'B',
        verified: true,
        former_member: false,
        extra: false,
        adults: 1,
        children: 1,
        places: 2,
        current_places: 0,
        requested_at: '2026-10-09T05:00:00Z',
        expires_at: '2026-10-10T13:00:00Z',
      },
    ],
    done: [],
    ...overrides,
  });

  beforeEach(() => show(hostedDropoffEvent));

  it('AC-17.16 "J’accepte" in one tap', async () => {
    mockEvents.requests.mockResolvedValue(list());
    mockEvents.acceptRequest.mockResolvedValue({ event: hostedDropoffEvent });
    await open(`/events/${eid}/requests`);
    expect(await screen.findByText('2 demandes en attente')).toBeOnTheScreen();
    expect(screen.getByText('Envoyée il y a 2 h')).toBeOnTheScreen();
    expect(
      screen.getAllByText('Numéro d’urgence visible après ton acceptation'.replace('’', "'")),
    ).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('accept-r1'));
    await waitFor(() => expect(mockEvents.acceptRequest).toHaveBeenCalledWith(eid, 'r1'));
  });

  it('AC-17.16 "Je décline" asks once, the safe option first', async () => {
    mockEvents.requests.mockResolvedValue(list());
    mockEvents.declineRequest.mockResolvedValue({ event: hostedDropoffEvent });
    await open(`/events/${eid}/requests`);
    await fireEvent.press(await screen.findByTestId('decline-r1'));
    expect(await screen.findByText('Décliner la demande de Sofia R. ?')).toBeOnTheScreen();
    expect(mockEvents.declineRequest).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm-decline'));
    await waitFor(() => expect(mockEvents.declineRequest).toHaveBeenCalledWith(eid, 'r1'));
  });

  it('AC-17.20 "J’accepte tout" only when everything fits, after one confirmation', async () => {
    expect(allFit(list().requests, 4)).toBe(true);
    expect(allFit(list().requests, 3)).toBe(false);
    mockEvents.requests.mockResolvedValue(list());
    mockEvents.acceptAll.mockResolvedValue({ accepted: 2, closed: 0, event: hostedDropoffEvent });
    await open(`/events/${eid}/requests`);
    await fireEvent.press(await screen.findByTestId('accept-all'));
    expect(await screen.findByText('Accepter les 2 demandes ?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-accept-all'));
    await waitFor(() => expect(mockEvents.acceptAll).toHaveBeenCalledWith(eid));
  });

  it('AC-17.17 a request that doesn’t fit: accept disabled, decline or raise the places', async () => {
    mockEvents.requests.mockResolvedValue(list({ places_left: 1 }));
    await open(`/events/${eid}/requests`);
    expect(await screen.findByTestId('request-not-enough-r1')).toHaveTextContent(
      'Pas assez de places : il en reste 1.',
    );
    expect(screen.getByTestId('accept-r1')).toBeDisabled();
    expect(screen.queryByTestId('accept-all')).toBeNull();
    expect(
      screen.getByText('Il manque des places pour tout accepter : décide demande par demande.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('raise-r1'));
    expect(await screen.findByTestId('event-form')).toBeOnTheScreen();
  });

  it('AC-17.17 a refused accept refreshes the list', async () => {
    mockEvents.requests.mockResolvedValue(list());
    mockEvents.acceptRequest.mockRejectedValue(
      apiError(409, 'not_enough_places', 'Il ne reste que 1 place.'),
    );
    await open(`/events/${eid}/requests`);
    await fireEvent.press(await screen.findByTestId('accept-r1'));
    await waitFor(() => expect(mockEvents.requests.mock.calls.length).toBeGreaterThan(1));
  });

  it('AC-17.23 a suspended event freezes the requests', async () => {
    mockEvents.requests.mockResolvedValue(list({ frozen: true }));
    await open(`/events/${eid}/requests`);
    expect(await screen.findByText('Sortie en pause')).toBeOnTheScreen();
    expect(screen.getByTestId('accept-r1')).toBeDisabled();
    expect(screen.getByTestId('decline-r1')).toBeDisabled();
  });

  it('design 3.5 "Terminées" shows 5 rows, then « Voir les N autres »', async () => {
    const done = Array.from({ length: 8 }, (_, i) => ({
      id: `d${i}`,
      first_name: `Parent${i}`,
      last_name_initial: 'P',
      verified: true,
      former_member: false,
      status: 'declined' as const,
      closed_reason: null,
      places: 1,
      decided_at: '2026-10-09T09:00:00Z',
    }));
    mockEvents.requests.mockResolvedValue(list({ done }));
    await open(`/events/${eid}/requests`);
    expect(await screen.findByTestId('done-d4')).toBeOnTheScreen();
    expect(screen.queryByTestId('done-d5')).toBeNull();
    await fireEvent.press(screen.getByText('Voir les 3 autres'));
    expect(await screen.findByTestId('done-d7')).toBeOnTheScreen();
    expect(screen.queryByTestId('requests-done-more')).toBeNull();
  });

  it('the decline sheet is neutral and plurals agree (Q-3, Q-8)', async () => {
    mockEvents.requests.mockResolvedValue({
      ...list({ places_left: 5 }),
      requests: [{ ...list().requests[0]!, places: 1 }],
    });
    await open(`/events/${eid}/requests`);
    expect(await screen.findByTestId('requests-caption')).toHaveTextContent(
      "1 place demandée, 5 restantes. Dans l'ordre d'arrivée.",
    );
    await fireEvent.press(screen.getByTestId('decline-r1'));
    expect(
      await screen.findByText(
        "La personne reçoit un message neutre : tu ne peux pas donner suite. Aucun motif n'est affiché.",
      ),
    ).toBeOnTheScreen();
    expect(i18n.t('events.dropoff.placesRemaining', { count: 1 })).toBe('1 restante');
    expect(i18n.t('events.dropoff.acceptAllPartial', { count: 1 })).toBe(
      '1 acceptée, les autres sont closes : la sortie est complète.',
    );
    expect(i18n.t('events.dropoff.declineBody', { lng: 'en' })).toBe(
      "They get a neutral message: you can't take the request. No reason is shown.",
    );
  });

  it('empty: the 📬 state', async () => {
    mockEvents.requests.mockResolvedValue(list({ requests: [] }));
    await open(`/events/${eid}/requests`);
    expect(await screen.findByTestId('requests-empty')).toBeOnTheScreen();
  });
});
