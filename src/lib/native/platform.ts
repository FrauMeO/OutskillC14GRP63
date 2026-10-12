// Thin, safe wrappers around the Capacitor native shell.
//
// Rules for everything in src/lib/native:
//  - On the web (the normal website) nothing here may throw and nothing native is loaded.
//    `@capacitor/core` is tiny and safe everywhere. Every other plugin is loaded with a
//    dynamic import() and only after isNative() is true, so the website bundle never pays for
//    them and never touches a missing native bridge.
//  - Every function resolves quietly if the plugin is missing or fails: the app must still work.
import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'ios' | 'android' | 'web';

/** True only inside the iPhone or Android app, never in a browser. */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function platform(): AppPlatform {
  try {
    const p = Capacitor.getPlatform();
    return p === 'ios' || p === 'android' ? p : 'web';
  } catch {
    return 'web';
  }
}

export type Unsubscribe = () => void;
const noop: Unsubscribe = () => {};

/**
 * Calls `cb(true)` when the app comes to the front and `cb(false)` when it goes to the back.
 * Returns a function that removes the listener. On the web it does nothing.
 */
export async function onAppActiveChange(cb: (isActive: boolean) => void): Promise<Unsubscribe> {
  if (!isNative()) return noop;
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('appStateChange', ({ isActive }) => cb(isActive));
    return () => {
      void handle.remove();
    };
  } catch {
    return noop;
  }
}

/**
 * Android hardware or gesture back button. Only Android sends this event; iOS has no such button,
 * so the listener is simply never called there. `cb` decides what to do (see backNavigation.ts).
 */
export async function onBackButton(cb: () => void): Promise<Unsubscribe> {
  if (platform() !== 'android') return noop;
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('backButton', () => cb());
    return () => {
      void handle.remove();
    };
  } catch {
    return noop;
  }
}

/** Closes the app (Android back button at the first screen). No effect on the web. */
export async function exitApp(): Promise<void> {
  if (!isNative()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch {
    /* nothing to do */
  }
}

/** Dark clock and battery icons on our light screens. No effect on the web. */
export async function setDarkStatusBarIcons(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Capacitor names this from the page's point of view: Style.Light means "light background".
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* nothing to do */
  }
}

/** Hides the launch screen once the first screen is ready. No effect on the web. */
export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* nothing to do */
  }
}
