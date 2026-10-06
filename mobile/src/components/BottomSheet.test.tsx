import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet, Text, type View } from 'react-native';

import i18n from '../i18n';
import { renderWithProviders, SAFE_AREA_METRICS } from '../test/render';
import { BottomSheet, SHEET_TOP_MARGIN } from './BottomSheet';
import { Button } from './Button';

// The test renderer has no native tags: give the opener one.
const mockFindNodeHandle = jest.fn((instance: unknown) => (instance ? 42 : null));
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (instance: unknown) => mockFindNodeHandle(instance),
}));

function Opener() {
  const [open, setOpen] = useState(false);
  const opener = useRef<View>(null);
  return (
    <>
      <Button ref={opener} label="Ouvrir" onPress={() => setOpen(true)} testID="opener" />
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        returnFocusTo={opener}
        testID="sheet"
      >
        <Text>Contenu</Text>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet (design system section 10)', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('M-5 gives the screen reader focus back to the opener when it closes', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation();
    await renderWithProviders(<Opener />);

    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(screen.getByText('Contenu')).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
    expect(focus).toHaveBeenCalledWith(42);
    expect(mockFindNodeHandle).toHaveBeenLastCalledWith(expect.anything());
    focus.mockRestore();
  });

  it('keeps the sheet below the status bar: max height is the screen minus the top inset', async () => {
    await renderWithProviders(
      <BottomSheet visible onClose={() => {}} testID="sheet">
        <Text>Contenu</Text>
      </BottomSheet>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('sheet').props.style);
    expect(style.maxHeight).toBe(
      Dimensions.get('window').height - SAFE_AREA_METRICS.insets.top - SHEET_TOP_MARGIN,
    );
  });

  it('scrolls its content (taps reach buttons with the keyboard up) and pins the footer', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <BottomSheet
        visible
        onClose={() => {}}
        footer={<Button label="Envoyer" onPress={onPress} />}
        testID="sheet"
      >
        <Text>Contenu</Text>
      </BottomSheet>,
    );
    const scroll = screen.getByTestId('sheet-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByText('Contenu')).toBeOnTheScreen();
    // The footer sits outside the scrolling content, so it stays visible.
    expect(screen.getByTestId('sheet-footer')).not.toContainElement(screen.getByText('Contenu'));
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onPress).toHaveBeenCalled();
  });
});
