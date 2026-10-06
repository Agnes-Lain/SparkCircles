import { fireEvent, screen } from '@testing-library/react-native';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '../test/render';
import { shadows } from '../theme/colors';
import { HeaderIconButton } from './HeaderIconButton';

describe('HeaderIconButton (design system v1.8, option A)', () => {
  it('is a 44 px labelled button with the icon-btn shadow', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <HeaderIconButton
        icon={ChevronLeft}
        accessibilityLabel="Retour"
        onPress={onPress}
        testID="btn"
      />,
    );

    const button = screen.getByRole('button', { name: 'Retour' });
    const style = StyleSheet.flatten(button.props.style);
    expect(style).toMatchObject({ width: 44, height: 44, boxShadow: shadows['icon-btn'] });

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
