import { File } from 'expo-file-system';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';

import type { SparkEvent } from '../../api/events';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { mockAuth, mockEvents, resetApiMock } from '../../test/apiMock';
import {
  acceptedDropoffEvent,
  eventFixture,
  eventOptionsFixture,
  eventPage,
  guestEvent,
  hostedEvent,
  joinedEvent,
  pendingDropoffEvent,
} from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import {
  buildIcs,
  canAddToCalendar,
  escapeText,
  foldLine,
  ICS_FILE_NAME,
  icsDateTime,
} from './calendar';
import { EventDetailScreen } from './EventDetailScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

type MockFile = {
  uri: string;
  exists: boolean;
  content?: string;
  create: jest.Mock;
  write: jest.Mock;
  delete: jest.Mock;
};
const mockFiles: MockFile[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: jest.fn().mockImplementation((dir: { uri: string }, name: string) => {
    const file = {
      uri: `${dir.uri}${name}`,
      exists: false,
      content: undefined as string | undefined,
      create: jest.fn(() => {
        file.exists = true;
      }),
      write: jest.fn((text: string) => {
        file.content = text;
      }),
      delete: jest.fn(() => {
        file.exists = false;
      }),
    };
    mockFiles.push(file);
    return file;
  }),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn() }));

const sharing = Sharing as jest.Mocked<typeof Sharing>;
const NOW = new Date('2026-10-09T10:00:00Z');
const COPY = { description: "Sortie SparkCircles. Ouvre l'app pour les détails." };
/** Unfolded content lines of a .ics. */
const octets = (text: string) => new TextEncoder().encode(text).length;
const unfold = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n');

describe('#41 .ics builder', () => {
  it('writes one VEVENT with a stable UID, DTSTAMP and UTC times', () => {
    const ics = buildIcs(joinedEvent, COPY, NOW);
    const lines = unfold(ics);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines).toContain(`UID:${joinedEvent.id}@sparkcircles.fr`);
    expect(lines).toContain('DTSTAMP:20261009T100000Z');
    expect(lines).toContain('DTSTART:20261010T130000Z');
    expect(lines).toContain('DTEND:20261010T150000Z');
    expect(lines).toContain('SUMMARY:Goûter et jeux au parc');
    expect(lines).toContain('STATUS:CONFIRMED');
    expect(lines).toContain(
      `DESCRIPTION:Sortie SparkCircles. Ouvre l'app pour les détails.\\nsparkcircles://events/${joinedEvent.id}`,
    );
  });

  it('converts offsets to UTC', () => {
    expect(icsDateTime('2026-10-10T15:00:00+02:00')).toBe('20261010T130000Z');
  });

  it('escapes commas, semicolons, backslashes and newlines', () => {
    expect(escapeText('a,b;c\\d\ne\r\nf')).toBe('a\\,b\\;c\\\\d\\ne\\nf');
    const lines = unfold(
      buildIcs({ ...joinedEvent, title: 'Pique-nique; jeux, goûter' }, COPY, NOW),
    );
    expect(lines).toContain('SUMMARY:Pique-nique\\; jeux\\, goûter');
    expect(lines).toContain('LOCATION:14 rue des Lilas\\, 75011 Paris');
  });

  it('folds lines at 75 octets without splitting a character', () => {
    const long = `SUMMARY:${'é'.repeat(100)}`;
    const folded = foldLine(long);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(octets(part)).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) expect(part.startsWith(' ')).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
    for (const line of buildIcs({ ...joinedEvent, title: 'x'.repeat(200) }, COPY, NOW).split(
      '\r\n',
    ))
      expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it('puts the area, never the address, when the viewer has not been given it', () => {
    const lines = unfold(buildIcs({ ...eventFixture, exact_address: undefined }, COPY, NOW));
    expect(lines).toContain('LOCATION:Paris 11e');
    expect(lines.join('\n')).not.toMatch(/rue/);
  });

  it('never carries the phone numbers or the participants', () => {
    const ics = buildIcs(acceptedDropoffEvent, COPY, NOW);
    expect(ics).not.toMatch(/612345678|698765432|06 12/);
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|Sofia/);
    expect(buildIcs(joinedEvent, COPY, NOW)).not.toMatch(/Sofia|ATTENDEE/);
  });
});

describe('#41 who sees « Ajouter à mon calendrier »', () => {
  it('shows it to the host and accepted participants only', () => {
    expect(canAddToCalendar(hostedEvent, NOW)).toBe(true);
    expect(canAddToCalendar(joinedEvent, NOW)).toBe(true);
    expect(canAddToCalendar(acceptedDropoffEvent, NOW)).toBe(true);
    expect(canAddToCalendar(eventFixture, NOW)).toBe(false);
    expect(canAddToCalendar(pendingDropoffEvent, NOW)).toBe(false);
    expect(canAddToCalendar(guestEvent, NOW)).toBe(false);
  });

  it('hides it when cancelled, on hold, a draft, past or without a date', () => {
    expect(canAddToCalendar({ ...joinedEvent, status: 'cancelled' }, NOW)).toBe(false);
    expect(canAddToCalendar({ ...hostedEvent, status: 'suspended' }, NOW)).toBe(false);
    expect(canAddToCalendar({ ...hostedEvent, status: 'draft' }, NOW)).toBe(false);
    expect(canAddToCalendar({ ...joinedEvent, status: 'past' }, NOW)).toBe(false);
    expect(canAddToCalendar(joinedEvent, new Date('2026-10-10T15:00:00Z'))).toBe(false);
    expect(canAddToCalendar({ ...hostedEvent, starts_at: null }, NOW)).toBe(false);
  });
});

describe('#41 on the event detail', () => {
  const ROUTES = { index: routeStub('index'), 'events/[id]/index': EventDetailScreen };
  const secureStore = SecureStore as unknown as { __reset: () => void };
  let serial = 0;
  let eid = '';
  const show = (event: SparkEvent) => {
    serial += 1;
    eid = `${event.id.slice(0, -4)}${String(serial).padStart(4, '0')}`;
    mockEvents.get.mockResolvedValue({ event: { ...event, id: eid } });
  };
  const open = async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ME_KEY, meFixture);
    return renderScreen(ROUTES, {
      url: `/events/${eid}`,
      token: 'jwt',
      gate: 'ready',
      queryClient,
    });
  };

  beforeEach(async () => {
    resetApiMock();
    secureStore.__reset();
    mockFiles.length = 0;
    (File as unknown as jest.Mock).mockClear();
    sharing.shareAsync.mockReset().mockResolvedValue(undefined);
    sharing.isAvailableAsync.mockReset().mockResolvedValue(true);
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
    jest.setSystemTime(NOW);
    await i18n.changeLanguage('fr');
  });

  afterEach(() => jest.useRealTimers());

  it('shares the .ics as text/calendar and confirms with a toast', async () => {
    show(joinedEvent);
    await open();
    const link = await screen.findByTestId('add-to-calendar-link');
    expect(screen.getByLabelText('Ajouter Goûter et jeux au parc à mon calendrier')).toBe(link);
    await fireEvent.press(link);
    await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalled());
    expect(sharing.shareAsync).toHaveBeenCalledWith(`file:///cache/${ICS_FILE_NAME}`, {
      mimeType: 'text/calendar',
      UTI: 'public.calendar-event',
      dialogTitle: 'Ajouter à mon calendrier',
    });
    expect(mockFiles[0]!.content).toContain('LOCATION:14 rue des Lilas\\, 75011 Paris');
    expect(mockFiles[0]!.exists).toBe(false);
    expect(await screen.findByText('Sortie prête pour ton calendrier')).toBeOnTheScreen();
  });

  it('shows the inline note with the date when sharing is not available', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    show(hostedEvent);
    await open();
    await fireEvent.press(await screen.findByTestId('add-to-calendar-link'));
    expect(await screen.findByTestId('calendar-fallback')).toHaveTextContent(
      /^On n'a pas pu créer le fichier\. Réessaie, ou note la date : Samedi 10 octobre · 15:00–17:00\.$/,
    );
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('is not shown for a pending request or a cancelled event', async () => {
    show(pendingDropoffEvent);
    await open();
    expect(await screen.findByTestId('where')).toBeOnTheScreen();
    expect(screen.queryByTestId('add-to-calendar')).toBeNull();

    show({ ...joinedEvent, status: 'cancelled' });
    await open();
    expect(await screen.findByTestId('where')).toBeOnTheScreen();
    expect(screen.queryByTestId('add-to-calendar')).toBeNull();
  });
});
