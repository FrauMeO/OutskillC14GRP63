// Install guidance for the "Add to your phone" section. Pure so it can be tested without a browser.
// Browsers that fire `beforeinstallprompt` (Chrome, Edge, Samsung Internet) get a real install button;
// everything else gets a plain-words hint chosen here from the user agent.

export type InstallPlatform =
  | 'ios' // every browser on iPhone and iPad installs through the Share sheet
  | 'safari-mac'
  | 'firefox-desktop'
  | 'firefox-android'
  | 'chromium' // Chrome, Edge, Samsung Internet, Opera: menu entry if the prompt is unavailable
  | 'other';

export function detectInstallPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  // iPadOS 13+ reports itself as a Mac, so a Mac with a touch screen is an iPad.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Firefox\//.test(ua)) return /Android/.test(ua) ? 'firefox-android' : 'firefox-desktop';
  if (/Chrome\/|Chromium\/|Edg\/|OPR\/|SamsungBrowser\//.test(ua)) return 'chromium';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) return 'safari-mac';
  return 'other';
}

export function installHint(platform: InstallPlatform): string {
  switch (platform) {
    case 'ios':
      return 'Tap Share, then Add to Home Screen.';
    case 'safari-mac':
      return 'In the File menu, choose Add to Dock.';
    case 'firefox-android':
      return 'Open the Firefox menu, then choose Install.';
    case 'firefox-desktop':
      return 'Firefox on a computer cannot install web apps. Open this page in Chrome or Edge to install it, or bookmark it.';
    case 'chromium':
      return 'Open the browser menu, then choose Install app or Add to Home screen.';
    default:
      return 'Open your browser menu and look for Install, Add to Home screen or Add to Dock. You can also just bookmark this page.';
  }
}
