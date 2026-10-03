import { Image } from 'react-native';

// Ripple horizontal lockup (design system section 19), exported from
// docs/design/brand/ripple/ripple-lockup-horizontal.svg by scripts/export-brand-assets.sh.
const LOCKUP = require('../../assets/brand/lockup-horizontal.png');
const RATIO = 399 / 120;

/** The SparkCircles logo for Welcome, 40 px tall by default (32–40 px in the app). */
export function Wordmark({ height = 40 }: { height?: number }) {
  return (
    <Image
      source={LOCKUP}
      accessibilityRole="image"
      accessibilityLabel="SparkCircles"
      style={{ height, width: height * RATIO }}
      resizeMode="contain"
    />
  );
}
