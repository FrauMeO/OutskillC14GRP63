import type { CapacitorConfig } from '@capacitor/cli'

// Build Your Pillars: native shell (Capacitor 8) around the same React build.
//
// appId is a PLACEHOLDER. It becomes the iOS bundle id and the Android package
// name and CANNOT be changed after the first store upload. Founders must
// confirm `com.buildyourpillars.app` (docs/mobile-build.md, section 2) before
// any upload. Changing it later means a brand-new store listing.
//
// No `server.url` on purpose: the app ships its web files inside the install so
// it opens with no signal. Never add a remote server URL to a production build.
const config: CapacitorConfig = {
  appId: 'com.buildyourpillars.app',
  appName: 'Build Your Pillars',
  webDir: 'dist',
  backgroundColor: '#edf1ee', // --color-mist in src/index.css, shown behind the web view
  server: {
    // Deliberately NO `url`. Keep the app on its own https://localhost origin.
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // Release builds must not be debuggable from Chrome.
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      // --color-spruce in src/index.css
      backgroundColor: '#1e3b37',
      launchShowDuration: 1200,
      launchAutoHide: true,
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
    StatusBar: {
      // The app screens are light (--color-mist), so the clock and battery need DARK glyphs.
      // In Capacitor's naming that is style 'LIGHT' ("light background"). Android 15+ draws
      // edge to edge and ignores a status-bar colour, so none is set here.
      style: 'LIGHT',
    },
  },
}

export default config
