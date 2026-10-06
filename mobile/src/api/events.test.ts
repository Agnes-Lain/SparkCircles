import { jsonResponse, memoryTokenStore } from '../test/fakes';
import { createApiClient } from './client';
import { eventsApi, searchQuery } from './events';

function setup() {
  const fetchImpl = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const client = createApiClient({
    baseUrl: 'http://api.test',
    tokenStore: memoryTokenStore('jwt'),
    getLocale: () => 'fr',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const last = () => {
    const [url, init] = fetchImpl.mock.calls.at(-1) ?? [];
    return { url: String(url), init: init as RequestInit };
  };
  return { api: eventsApi(client), fetchImpl, last };
}

describe('events API client (docs/api/events.md)', () => {
  it('AC-3.2 sends only the filters that are set, categories comma-separated', () => {
    expect(
      searchQuery(
        { area: ['paris-11'], radius_km: 5, category: ['sport', 'music'], from: '2026-10-10' },
        2,
      ),
    ).toBe('area=paris-11&radius_km=5&category=sport%2Cmusic&from=2026-10-10&page=2');
    expect(searchQuery({ radius_km: 5, q: '' }, 1)).toBe('page=1');
  });

  it('multi-area: several areas as area[], "Tout Paris" as no area at all', () => {
    expect(searchQuery({ area: ['paris-11', 'paris-20'], radius_km: 2 }, 1)).toBe(
      'area%5B%5D=paris-11&area%5B%5D=paris-20&radius_km=2&page=1',
    );
    expect(searchQuery({ area: [], radius_km: 2 }, 1)).toBe('page=1');
  });

  it('AC-3.10 searches a tag without its "#"', async () => {
    const { api, fetchImpl, last } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(200, { events: [], pagination: {} }));
    await api.search({ area: ['paris-11'], tag: 'foot' }, 1);
    expect(last().url).toBe('http://api.test/api/v1/events?area=paris-11&tag=foot&page=1');
  });

  it('AC-5.2 joins with adults and children', async () => {
    const { api, fetchImpl, last } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(201, { event: {} }));
    await api.join('abc', { adults: 1, children: 2 });
    expect(last().url).toBe('http://api.test/api/v1/events/abc/participation');
    expect(last().init.method).toBe('POST');
    expect(JSON.parse(String(last().init.body))).toEqual({ adults: 1, children: 2 });
  });

  it('AC-5.3 keeps places_left from a not_enough_places refusal', async () => {
    const { api, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(
      jsonResponse(409, {
        error: { code: 'not_enough_places', message: 'Only 2 places left.', places_left: 2 },
      }),
    );
    await expect(api.join('abc', { adults: 3, children: 0 })).rejects.toMatchObject({
      code: 'not_enough_places',
      placesLeft: 2,
    });
  });

  it('AC-1.1 creates a draft or publishes in one step', async () => {
    const { api, fetchImpl, last } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(201, { event: {} }));
    await api.create({ title: 'Foot' }, true);
    expect(JSON.parse(String(last().init.body))).toEqual({
      event: { title: 'Foot' },
      publish: true,
    });
  });

  it('AC-9.1 reports with a reason and optional details', async () => {
    const { api, fetchImpl, last } = setup();
    fetchImpl.mockImplementation(async () => jsonResponse(201, { report: {} }));
    await api.report('abc', 'inappropriate_tag');
    expect(JSON.parse(String(last().init.body))).toEqual({ reason: 'inappropriate_tag' });
    await api.report('abc', 'other', 'Détails');
    expect(JSON.parse(String(last().init.body))).toEqual({ reason: 'other', details: 'Détails' });
  });
});
