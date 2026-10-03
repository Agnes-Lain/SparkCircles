const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // Expo's defaults, plus the libraries we ship untranspiled.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|nativewind|react-native-css-interop|react-native-svg))',
    ...expoPreset.transformIgnorePatterns.slice(1),
  ],
  // lucide-react-native's default entry is ESM (.mjs); Jest uses its CommonJS build.
  moduleNameMapper: {
    // The root layout imports global.css (NativeWind); Jest doesn't need it.
    '\\.css$': '<rootDir>/src/test/styleStub.js',
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
