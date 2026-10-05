import type { ExpoConfig } from 'expo/config';

// Colors come from the design tokens (design system section 15), never typed here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { colors } = require('./src/theme/tokens');

// Permission texts approved by the PM (M-25). English is the default; the French ones are
// applied through `locales` on iOS. Android shows its own system wording.
const PERMISSIONS = {
  en: {
    camera:
      'SparkCircles uses your camera to take photos of your ID and a selfie when you verify your identity.',
    photos: 'SparkCircles opens your photos only when you choose a picture of your ID.',
  },
  fr: {
    camera:
      "SparkCircles utilise ton appareil photo pour photographier ta pièce d'identité et prendre un selfie quand tu vérifies ton identité.",
    photos:
      "SparkCircles accède à tes photos seulement quand tu choisis une photo de ta pièce d'identité.",
  },
};

const iosPermissionStrings = (texts: { camera: string; photos: string }) => ({
  ios: { NSCameraUsageDescription: texts.camera, NSPhotoLibraryUsageDescription: texts.photos },
});

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
    // Lets iOS use the `locales` strings below in French or English.
    infoPlist: { CFBundleAllowMixedLocalizations: true },
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
    // No microphone, even if a future package asks for it (M-25, QA-V7).
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
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
    [
      'expo-camera',
      {
        cameraPermission: PERMISSIONS.en.camera,
        // Photos only, never video: no microphone (M-25).
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: PERMISSIONS.en.photos,
        cameraPermission: PERMISSIONS.en.camera,
        microphonePermission: false,
      },
    ],
  ],
  locales: {
    en: iosPermissionStrings(PERMISSIONS.en),
    fr: iosPermissionStrings(PERMISSIONS.fr),
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
