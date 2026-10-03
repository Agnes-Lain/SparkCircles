const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem 16: Tailwind's default sizes match the design in pixels (e.g. min-h-11 = 44 px).
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
