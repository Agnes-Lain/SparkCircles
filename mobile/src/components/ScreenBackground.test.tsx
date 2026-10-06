import { render, screen } from '@testing-library/react-native';

import { shellGradient } from '../theme/shellGradient';
import { ScreenBackground } from './ScreenBackground';

// The native SVG views drop their props in the test renderer: render each SVG element as a
// plain view named after it, so the test can read what ScreenBackground passes.
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const element = (name: string) =>
    function SvgElement(props: object) {
      return <View testID={name} {...props} />;
    };
  return {
    __esModule: true,
    default: element('svg'),
    Defs: element('defs'),
    LinearGradient: element('linear-gradient'),
    Rect: element('rect'),
    Stop: element('stop'),
  };
});

describe('ScreenBackground (shell-gradient, design system v1.6)', () => {
  it('draws a straight vertical gradient from the shellGradient constant', async () => {
    await render(<ScreenBackground />);
    const gradient = screen.getByTestId('linear-gradient');
    expect(gradient.props).toMatchObject({ x1: '0', y1: '0', x2: '0', y2: '1' });
    const stops = screen.getAllByTestId('stop');
    expect(stops.map((stop) => [stop.props.offset, stop.props.stopColor])).toEqual(
      shellGradient.stops.map((stop) => [stop.offset, stop.color]),
    );
    expect(screen.getByTestId('rect').props).toMatchObject({ width: '100%', height: '100%' });
  });

  it('fills the screen behind the content and never takes touches', async () => {
    await render(<ScreenBackground />);
    const background = screen.getByTestId('screen-background');
    expect(background).toHaveProp('pointerEvents', 'none');
    expect(background).toHaveStyle({ position: 'absolute', top: 0, bottom: 0 });
  });
});
