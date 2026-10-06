import Svg, { Path } from 'react-native-svg';

import { colorValue } from '../../theme/colors';

/**
 * The full-colour Ripple symbol (design system section 19, mint-ring version), paths copied
 * from docs/design/brand/ripple/ripple-symbol.svg (96-unit grid). Ring colours are the accent
 * Base tokens, from the inside out: pink, lavender, sky, mint; lemon spark. Decorative by
 * default: the control that shows it carries the label.
 */
export function RippleSymbol({ size = 58, testID }: { size?: number; testID?: string }) {
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M53.69,35.21 A14,14 0 1 1 42.31,35.21"
        fill="none"
        stroke={colorValue('pink')}
        strokeWidth={6.5}
        strokeLinecap="round"
      />
      <Path
        d="M25.91,57.38 A24,24 0 1 1 34.93,68.13"
        fill="none"
        stroke={colorValue('lavender')}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Path
        d="M72.87,71.19 A34,34 0 0 1 14.87,40.35 M29.48,19.49 A34,34 0 0 1 80.51,57.94"
        fill="none"
        stroke={colorValue('sky')}
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      <Path
        d="M21.53,81.88 A43,43 0 1 1 75.06,14.58 M85.61,27.15 A43,43 0 0 1 46.5,90.97"
        fill="none"
        stroke={colorValue('green')}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <Path
        d="M48,39.5 C49.19,45.62 50.38,46.81 56.5,48 C50.38,49.19 49.19,50.38 48,56.5 C46.81,50.38 45.62,49.19 39.5,48 C45.62,46.81 46.81,45.62 48,39.5Z"
        fill={colorValue('sunny')}
      />
    </Svg>
  );
}
