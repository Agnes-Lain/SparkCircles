import { QueryClient } from '@tanstack/react-query';

import { eventKey, eventSearchKey, myEventsKey, type SparkEvent } from '../../api/events';
import { mockEvents, resetApiMock } from '../../test/apiMock';
import { eventPage, joinedEvent } from '../../test/eventFixtures';
import { forgetParticipation, freshEvent } from './queries';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const SEARCH = eventSearchKey({ area: ['paris-11'] });
const MINE = myEventsKey('participant', 'upcoming');

const clients: QueryClient[] = [];

/** A cache holding the joined event in its detail, a search list and "Mes sorties". */
function cacheWithJoinedEvent() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const list = { pages: [eventPage([joinedEvent])], pageParams: [1] };
  client.setQueryData(eventKey(joinedEvent.id), joinedEvent);
  client.setQueryData(SEARCH, list);
  client.setQueryData(MINE, list);
  return client;
}

/** The event as each cached list holds it (`undefined` when the list is gone). */
function listed(client: QueryClient, key: readonly unknown[]) {
  const data = client.getQueryData<{ pages: { events: SparkEvent[] }[] }>(key);
  return data?.pages.flatMap((page) => page.events).find((event) => event.id === joinedEvent.id);
}

function expectNoInsiderDetails(event: SparkEvent | undefined) {
  expect(event).toBeDefined();
  expect(event?.exact_address).toBeUndefined();
  expect(event?.participants).toBeUndefined();
  expect(event?.my_participation).toBeUndefined();
}

describe('events cache privacy (AC-6.3, QA R2-1)', () => {
  beforeEach(() => resetApiMock());
  afterEach(() => clients.splice(0).forEach((client) => client.clear()));

  it('AC-6.3 freshEvent of a cancelled event strips the address from every cached list', async () => {
    const client = cacheWithJoinedEvent();
    const {
      exact_address: _a,
      participants: _p,
      my_participation: _m,
      ...cancelled
    } = {
      ...joinedEvent,
      status: 'cancelled' as const,
    };
    mockEvents.get.mockResolvedValue({ event: cancelled });

    await freshEvent(client, joinedEvent.id);

    expectNoInsiderDetails(listed(client, SEARCH));
    expectNoInsiderDetails(listed(client, MINE));
  });

  it('AC-6.3 freshEvent of a live event leaves the participant lists as they are', async () => {
    const client = cacheWithJoinedEvent();
    mockEvents.get.mockResolvedValue({ event: joinedEvent });

    await freshEvent(client, joinedEvent.id);

    expect(listed(client, SEARCH)?.exact_address).toBe(joinedEvent.exact_address);
  });

  it('AC-5.4 a leave strips the address from the search lists and drops "Mes sorties" at once', () => {
    const client = cacheWithJoinedEvent();
    mockEvents.get.mockReturnValue(new Promise(() => {}));
    mockEvents.search.mockReturnValue(new Promise(() => {}));

    forgetParticipation(client, joinedEvent.id);

    expectNoInsiderDetails(listed(client, SEARCH));
    expect(listed(client, MINE)).toBeUndefined();
  });
});
