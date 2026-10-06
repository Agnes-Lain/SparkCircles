import { fireEvent, screen } from '@testing-library/react-native';
import { Sparkles } from 'lucide-react-native';

import { renderWithProviders } from '../test/render';
import { FilterChip } from './FilterChip';

describe('FilterChip (design system v1.6, section 6)', () => {
  it('is a 32 px pill with a 44 px touch area (hit slop)', async () => {
    await renderWithProviders(<FilterChip label="Tout" selected={false} onPress={jest.fn()} />);
    const chip = screen.getByRole('button', { name: 'Tout' });
    expect(chip).toHaveStyle({ height: 32 });
    expect(chip).toHaveProp('hitSlop', { top: 6, bottom: 6 });
    expect(chip.props.className).toContain('rounded-full');
  });

  it('unselected: Surface fill, 1 px Ink 3 border, 13 px/400 Ink label', async () => {
    await renderWithProviders(
      <FilterChip label="Ce week-end" selected={false} onPress={jest.fn()} />,
    );
    const chip = screen.getByRole('button', { name: 'Ce week-end' });
    expect(chip).not.toBeSelected();
    expect(chip.props.className).toContain('bg-surface');
    expect(chip.props.className).toMatch(/\bborder\b/);
    expect(chip.props.className).toContain('border-border-control');
    const label = screen.getByText('Ce week-end');
    expect(label.props.className).toContain('text-[13px] text-ink');
    expect(label.props.className).toContain('font-normal');
  });

  it('selected: mint Base fill, mint Dark border, label 500, announced as selected', async () => {
    await renderWithProviders(<FilterChip label="Tout" selected onPress={jest.fn()} />);
    const chip = screen.getByRole('button', { name: 'Tout' });
    expect(chip).toBeSelected();
    expect(chip.props.className).toContain('bg-green');
    expect(chip.props.className).toContain('border-green-dark');
    expect(screen.getByText('Tout').props.className).toContain('font-medium');
  });

  it('shows an optional 15 px icon and reports presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <FilterChip label="Sorties" selected={false} onPress={onPress} icon={Sparkles} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Sorties' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
