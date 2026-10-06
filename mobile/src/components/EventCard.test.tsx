import { fireEvent, screen } from '@testing-library/react-native';

import i18n from '../i18n';
import { eventFixture, hostedEvent, joinedEvent } from '../test/eventFixtures';
import { renderWithProviders } from '../test/render';
import { EventCard } from './EventCard';

async function renderCard(event = eventFixture, mine = false) {
  const onPress = jest.fn();
  const onBadgePress = jest.fn();
  await renderWithProviders(
    <EventCard event={event} onPress={onPress} onBadgePress={onBadgePress} mine={mine} />,
  );
  return { onPress, onBadgePress };
}

beforeEach(() => i18n.changeLanguage('fr'));

describe('Event Card (design events 4.2)', () => {
  it('AC-3.4 AC-4.1 AC-4.3 shows type, title, time, area, category, host + badge, places', async () => {
    await renderCard();
    expect(screen.getByText('Sortie entre familles')).toBeOnTheScreen();
    expect(screen.getByText('Goûter et jeux au parc')).toBeOnTheScreen();
    expect(screen.getByText('Sam. 10 oct. · 15:00–17:00')).toBeOnTheScreen();
    expect(screen.getByText('Paris 11e · à 1,5 km de ta zone')).toBeOnTheScreen();
    expect(screen.getByText('Goûters')).toBeOnTheScreen();
    expect(screen.getByText('#parc')).toBeOnTheScreen();
    expect(screen.getByText('Camille D.')).toBeOnTheScreen();
    expect(screen.getByText('Vérifié ✓')).toBeOnTheScreen();
    expect(screen.getByText('Plus que 4 places sur 10')).toBeOnTheScreen();
    expect(screen.getByTestId('event-card-heart-slot')).toBeOnTheScreen();
  });

  it('AC-4.1 reads the type first in the card link name', async () => {
    await renderCard();
    expect(screen.getByRole('link').props.accessibilityLabel).toMatch(
      /^Sortie entre familles, Goûter et jeux au parc, Sam\. 10 oct\. · 15:00–17:00, .*organisée par Camille D\., vérifié/,
    );
  });

  it('AC-1.8 AC-3.6 marks almost full (3 or fewer) and full', async () => {
    await renderCard({ ...eventFixture, places: { total: 10, taken: 9, left: 1 } });
    expect(screen.getByText("Plus qu'une place sur 10")).toBeOnTheScreen();
    expect(screen.getByText('Presque complet')).toBeOnTheScreen();
    await screen.unmount();
    await renderCard({ ...eventFixture, full: true, places: { total: 10, taken: 10, left: 0 } });
    expect(screen.getByText('Complet · 10 places')).toBeOnTheScreen();
    expect(screen.getByText('Complet')).toBeOnTheScreen();
  });

  it('AC-6.4 never shows participant names on a card', async () => {
    await renderCard(joinedEvent);
    expect(screen.queryByText(/Sofia/)).toBeNull();
    expect(screen.getByText('Tu y vas')).toBeOnTheScreen();
  });

  it('AC-6.5 the badge opens B1; the card opens the detail', async () => {
    const { onPress, onBadgePress } = await renderCard();
    await fireEvent.press(screen.getByTestId(`event-card-badge-${eventFixture.id}`));
    expect(onBadgePress).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link'));
    expect(onPress).toHaveBeenCalled();
  });

  it('AC-7.1 in Mes sorties, the host reads "Toi" and the lifecycle badge', async () => {
    await renderCard({ ...hostedEvent, status: 'draft' }, true);
    expect(screen.getByText('Toi')).toBeOnTheScreen();
    expect(screen.getByText('Brouillon')).toBeOnTheScreen();
    expect(screen.queryByText('Vérifié ✓')).toBeNull();
  });
});
