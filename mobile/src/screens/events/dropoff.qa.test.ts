import { eventKey } from '../../api/events';
import type { SparkEvent } from '../../api/events';
import { createTestQueryClient } from '../../test/render';
import { acceptedDropoffEvent, hostedDropoffEvent } from '../../test/eventFixtures';
import { forgetParticipation, storeEvent } from './queries';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

// QA US-17: the phone-safe cache on leave and cancellation (AC-17.12).
describe('QA US-17 cache strips phones', () => {
  const cached = (client: ReturnType<typeof createTestQueryClient>, event: SparkEvent) =>
    client.getQueryData<SparkEvent>(eventKey(event.id));

  it('AC-17.12 leaving drops the host phone and my emergency phone at once', () => {
    const client = createTestQueryClient();
    const mine = { ...acceptedDropoffEvent.my_participation!, emergency_phone: '+33698765432' };
    client.setQueryData(eventKey(acceptedDropoffEvent.id), {
      ...acceptedDropoffEvent,
      my_participation: mine,
    });
    forgetParticipation(client, acceptedDropoffEvent.id);
    const after = cached(client, acceptedDropoffEvent);
    expect(after).not.toHaveProperty('host_phone');
    expect(after).not.toHaveProperty('my_participation');
    expect(JSON.stringify(after)).not.toMatch(/612345678|698765432/);
  });

  it('AC-17.12 a cancelled event leaves no participant or emergency phone, the host keeps their own', () => {
    const client = createTestQueryClient();
    storeEvent(client, { ...hostedDropoffEvent, status: 'cancelled' });
    const after = cached(client, hostedDropoffEvent)!;
    expect(after.host_phone).toBe(hostedDropoffEvent.host_phone);
    expect(after.participants?.every((person) => !('emergency_phone' in person))).toBe(true);
  });

  it('AC-17.12 a cancelled event strips the phone from a participant', () => {
    const client = createTestQueryClient();
    storeEvent(client, { ...acceptedDropoffEvent, status: 'cancelled' });
    expect(JSON.stringify(cached(client, acceptedDropoffEvent))).not.toContain('612345678');
  });
});
