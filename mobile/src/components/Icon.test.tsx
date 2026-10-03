import { House } from 'lucide-react-native';
import { screen } from '@testing-library/react-native';

import { colorValue } from '../theme/colors';
import { renderWithProviders } from '../test/render';
import { Icon } from './Icon';

describe('Icon (Lucide, stroke 1.8)', () => {
  it('draws with stroke 1.8, the requested size and the token color', async () => {
    await renderWithProviders(<Icon icon={House} color="green-dark" size={24} testID="icon" />);

    const icon = screen.getByTestId('icon', { includeHiddenElements: true });
    expect(icon).toHaveProp('strokeWidth', 1.8);
    expect(icon).toHaveProp('stroke', colorValue('green-dark'));
    expect(icon).toHaveProp('width', 24);
  });

  it('defaults to Ink, 20 px', async () => {
    await renderWithProviders(<Icon icon={House} testID="icon" />);

    const icon = screen.getByTestId('icon', { includeHiddenElements: true });
    expect(icon).toHaveProp('stroke', colorValue('ink'));
    expect(icon).toHaveProp('width', 20);
  });

  it('is decorative: hidden from screen readers', async () => {
    await renderWithProviders(<Icon icon={House} testID="icon" />);
    expect(screen.queryByTestId('icon')).toBeNull();
  });
});
