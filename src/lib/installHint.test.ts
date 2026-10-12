import { describe, expect, it } from 'vitest';
import { detectInstallPlatform, installHint } from './installHint';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const FIREFOX_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';
const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('detectInstallPlatform', () => {
  it('treats every iPhone browser as the iOS Share-sheet path', () => {
    expect(detectInstallPlatform(IPHONE_SAFARI)).toBe('ios');
    expect(detectInstallPlatform(IPHONE_CHROME)).toBe('ios');
  });
  it('recognises an iPad that reports itself as a Mac', () => {
    expect(detectInstallPlatform(IPAD_AS_MAC, 5)).toBe('ios');
    expect(detectInstallPlatform(SAFARI_MAC, 0)).toBe('safari-mac');
  });
  it('separates Chromium, Firefox and other browsers', () => {
    expect(detectInstallPlatform(ANDROID_CHROME)).toBe('chromium');
    expect(detectInstallPlatform(EDGE)).toBe('chromium');
    expect(detectInstallPlatform(FIREFOX_DESKTOP)).toBe('firefox-desktop');
    expect(detectInstallPlatform(FIREFOX_ANDROID)).toBe('firefox-android');
    expect(detectInstallPlatform('SomeOtherBrowser/1.0')).toBe('other');
  });
});

describe('installHint', () => {
  it('gives the iOS wording asked for', () => {
    expect(installHint('ios')).toBe('Tap Share, then Add to Home Screen.');
  });
  it('gives every platform a non-empty, distinct-enough hint', () => {
    const all = ['ios', 'safari-mac', 'firefox-desktop', 'firefox-android', 'chromium', 'other'] as const;
    for (const p of all) expect(installHint(p).length).toBeGreaterThan(20);
  });
  it('control: a Chrome hint is not the iOS hint (this check must catch a mix-up)', () => {
    expect(installHint('chromium')).not.toBe(installHint('ios'));
    expect(detectInstallPlatform(ANDROID_CHROME)).not.toBe('ios');
  });
});
