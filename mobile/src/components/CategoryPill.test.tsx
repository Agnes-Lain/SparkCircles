import { fireEvent, screen } from '@testing-library/react-native';
import { Dumbbell } from 'lucide-react-native';

import { renderWithProviders } from '../test/render';
import { CATEGORY_TONE, CategoryPill } from './CategoryPill';

describe('CategoryPill (design system v1.6, section 6)', () => {
  it('follows the category colour table: Dark icon on the Light circle', () => {
    expect(CATEGORY_TONE).toEqual({
      sport: { circle: 'bg-sky-light', icon: 'sky-dark' },
      music: { circle: 'bg-sky-light', icon: 'sky-dark' },
      outdoors: { circle: 'bg-green-light', icon: 'green-dark' },
      playdates: { circle: 'bg-green-light', icon: 'green-dark' },
      board_games: { circle: 'bg-lavender-light', icon: 'lavender-dark' },
      books: { circle: 'bg-lavender-light', icon: 'lavender-dark' },
      video_games: { circle: 'bg-pink-light', icon: 'pink-dark' },
      shows: { circle: 'bg-pink-light', icon: 'pink-dark' },
      crafts: { circle: 'bg-sunny-light', icon: 'sunny-dark' },
      workshops: { circle: 'bg-sunny-light', icon: 'sunny-dark' },
      other: { circle: 'bg-other-light', icon: 'ink-2' },
    });
  });

  it('display variant: Surface pill with a 22 px circle, Ink 3 border, not tappable', async () => {
    await renderWithProviders(
      <CategoryPill category="sport" label="Sport" icon={Dumbbell} testID="pill" />,
    );
    const pill = screen.getByTestId('pill');
    expect(pill.props.className).toContain('rounded-full');
    expect(pill.props.className).toContain('border border-border-control bg-surface');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Sport').props.className).toContain('text-[13px] font-normal text-ink');
    const circle = screen.getByTestId('category-icon-sport');
    expect(circle.props.className).toContain('h-[22px] w-[22px]');
    expect(circle.props.className).toContain('bg-sky-light');
  });

  it('interactive variant: the category filter chip, 44 px touch area, selected = mint', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <CategoryPill category="other" label="Autre" icon={Dumbbell} onPress={onPress} selected />,
    );
    const chip = screen.getByRole('button', { name: 'Autre' });
    expect(chip).toBeSelected();
    expect(chip).toHaveStyle({ height: 32 });
    expect(chip).toHaveProp('hitSlop', { top: 6, bottom: 6 });
    expect(chip.props.className).toContain('bg-green');
    expect(screen.getByTestId('category-icon-other').props.className).toContain('bg-other-light');
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
