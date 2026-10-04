import type { ExpoConfig } from 'expo/config';

// Colors come from the design tokens (design system section 15), never typed here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { colors } = require('./src/theme/tokens');

const config: ExpoConfig = {
  name: 'SparkCircles',
  slug: 'sparkcircles',
  version: '0.1.0',
  scheme: 'sparkcircles',
  orientation: 'portrait',
  // The design system defines a light theme only.
  userInterfaceStyle: 'light',
  backgroundColor: colors.shell,
  icon: './assets/brand/icon.png',
  ios: {
    supportsTablet: false,
    icon: {
      light: './assets/brand/icon.png',
      // The main icon is already the dark version (pastel ripple on Ink, section 19).
      dark: './assets/brand/icon.png',
      tinted: './assets/brand/icon-ios-tinted.png',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/brand/adaptive-icon-foreground.png',
      backgroundColor: colors.ink.DEFAULT,
      monochromeImage: './assets/brand/adaptive-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Stacked lockup on Shell (PM decision M-14).
        image: './assets/brand/splash-lockup.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: colors.shell,
      },
    ],
    'expo-secure-store',
    'expo-localization',
    'expo-web-browser',
    'expo-sharing',
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
