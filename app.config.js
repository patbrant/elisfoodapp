// app.config.js supersedes app.json and is evaluated in Node.js context by
// the Expo CLI — process.env is populated from .env.local before this runs.
// This is more reliable than Metro's EXPO_PUBLIC_* inline substitution which
// requires a cache-clear when the .env file changes.

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "Eli's Food App",
  slug: 'elis-food-app',
  scheme: 'elisfood',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'ch.patbrant.elisfoodapp',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: ['expo-router', 'expo-sqlite'],
  extra: {
    router: {},
    eas: {
      projectId: 'd5f190f2-5e65-4463-85fd-487675002270',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  owner: 'patbrans-org',
};

module.exports = config;
