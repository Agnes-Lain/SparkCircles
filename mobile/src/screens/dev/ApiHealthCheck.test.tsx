import { fireEvent, screen } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import i18n from '../../i18n';
import { renderWithProviders } from '../../test/render';
import { ApiHealthCheck } from './ApiHealthCheck';

describe('ApiHealthCheck (development only)', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('says the API is reachable when /up answers', async () => {
    const health = jest.fn().mockResolvedValue(true);
    await renderWithProviders(<ApiHealthCheck client={() => ({ health })} />);

    expect(await screen.findByText('API joignable')).toBeOnTheScreen();
  });

  it('shows the designed error notification and retries', async () => {
    const health = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'down'))
      .mockResolvedValueOnce(true);
    await renderWithProviders(<ApiHealthCheck client={() => ({ health })} />);

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    expect(screen.getByText('Vérifie ta connexion et réessaie.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('API joignable')).toBeOnTheScreen();
    expect(health).toHaveBeenCalledTimes(2);
  });
});
