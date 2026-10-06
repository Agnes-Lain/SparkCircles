import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colorValue } from '../theme/colors';
import { shellGradient } from '../theme/shellGradient';

/**
 * The mobile app background (design system v1.6, `shell-gradient`, sections 1 and 15):
 * drawn once behind the navigator, full screen including under the status bar and the home
 * indicator, fixed while content scrolls over it. Static, so nothing to do for reduced
 * motion. The flat `shell` fill underneath is the fallback if the SVG can't draw.
 * Camera screens and the admin back office keep flat `shell`.
 */
export function ScreenBackground() {
  return (
    <View
      testID="screen-background"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colorValue('shell') }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="shell-gradient" x1="0" y1="0" x2="0" y2="1">
            {shellGradient.stops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#shell-gradient)" />
      </Svg>
    </View>
  );
}
