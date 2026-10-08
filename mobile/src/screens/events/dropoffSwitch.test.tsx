import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import type { SparkEvent } from '../../api/events';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { apiError, mockAuth, mockEvents, resetApiMock } from '../../test/apiMock';
import { eventOptionsFixture, eventPage, hostedDropoffEvent } from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { EventFormScreen } from './EventFormScreen';
import { dropoffAllowed, EMPTY_FORM, toParams, withDropoffSwitch } from './formModel';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

// Web beta Q2: the server-side drop-off switch (`dropoff_enabled` in GET /event_options).

const ROUTES = {
  index: routeStub('index'),
  'events/[id]/index': routeStub('detail'),
  'events/[id]/edit': EventFormScreen,
  'events/new': EventFormScreen,
};

const secureStore = SecureStore as unknown as { __reset: () => void };
const switchedOff = { ...eventOptionsFixture, dropoff_enabled: false };
const dropoffDraft: SparkEvent = { ...hostedDropoffEvent, status: 'draft' };

async function open(url: string) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, meFixture);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

let eid = '';
let serial = 0;
const show = (event: SparkEvent) => {
  serial += 1;
  eid = `${event.id.slice(0, -4)}${String(serial).padStart(4, '0')}`;
  mockEvents.get.mockResolvedValue({ event: { ...event, id: eid } });
};

beforeEach(async () => {
  resetApiMock();
  secureStore.__reset();
  mockAuth.me.mockResolvedValue(meFixture);
  mockEvents.options.mockResolvedValue(switchedOff);
  mockEvents.mine.mockResolvedValue(eventPage([]));
  await i18n.changeLanguage('fr');
});

describe('drop-off switch, form model', () => {
  it('offers drop-off only when switched on, or for an already published drop-off event', () => {
    expect(dropoffAllowed(true)).toBe(true);
    expect(dropoffAllowed(false)).toBe(false);
    expect(dropoffAllowed(undefined)).toBe(false);
    expect(dropoffAllowed(false, dropoffDraft)).toBe(false);
    expect(dropoffAllowed(false, hostedDropoffEvent)).toBe(true);
  });

  it('switched off, a drop-off form becomes "adult required" and sends no phone', () => {
    const dropoff = { ...EMPTY_FORM, adultRequired: false, hostPhone: '06 12 34 56 78' };
    expect(withDropoffSwitch(dropoff, true)).toBe(dropoff);
    const params = toParams(withDropoffSwitch(dropoff, false), { includeRule: true });
    expect(params).toMatchObject({ adult_required: true, host_phone: null });
  });
});

describe('drop-off switch, event form', () => {
  it('switched off, the new event form hides "Présence d\'un adulte" and the drop-off fields', async () => {
    await open('/events/new');
    await waitFor(() => expect(mockEvents.options).toHaveBeenCalled());
    expect(await screen.findByTestId('form-language')).toBeOnTheScreen();
    expect(screen.queryByText("Présence d'un adulte")).toBeNull();
    expect(screen.queryByTestId('adult-optional')).toBeNull();
    expect(screen.queryByTestId('form-host-phone')).toBeNull();
  });

  it('switched on, the setting is offered as today', async () => {
    mockEvents.options.mockResolvedValue(eventOptionsFixture);
    await open('/events/new');
    expect(await screen.findByText("Présence d'un adulte")).toBeOnTheScreen();
    expect(screen.getByTestId('adult-optional')).toBeOnTheScreen();
  });

  it('switched off, a drop-off draft is edited as an event with an adult', async () => {
    show(dropoffDraft);
    mockEvents.update.mockResolvedValue({ event: { ...dropoffDraft, adult_required: true } });
    await open(`/events/${eid}/edit`);
    expect(await screen.findByTestId('form-draft')).toBeOnTheScreen();
    await waitFor(() => expect(mockEvents.options).toHaveBeenCalled());
    expect(screen.queryByTestId('form-host-phone')).toBeNull();
    expect(screen.queryByTestId('form-dropoff-notice')).toBeNull();
    await fireEvent.press(screen.getByTestId('form-draft'));
    await waitFor(() =>
      expect(mockEvents.update).toHaveBeenCalledWith(
        eid,
        expect.objectContaining({ adult_required: true, host_phone: null }),
      ),
    );
  });

  it('switched off, the host still sees their published drop-off event as it is', async () => {
    show(hostedDropoffEvent);
    await open(`/events/${eid}/edit`);
    expect(await screen.findByTestId('form-host-phone')).toBeOnTheScreen();
    expect(screen.getByText("Présence d'un adulte")).toBeOnTheScreen();
  });

  it('a dropoff_disabled refusal says drop-off is not available', async () => {
    show(dropoffDraft);
    mockEvents.update.mockRejectedValue(apiError(422, 'dropoff_disabled'));
    await open(`/events/${eid}/edit`);
    await fireEvent.press(await screen.findByTestId('form-draft'));
    expect(await screen.findByTestId('form-dropoff-disabled')).toHaveTextContent(
      /Les sorties sans adulte ne sont pas disponibles/,
    );
  });
});
