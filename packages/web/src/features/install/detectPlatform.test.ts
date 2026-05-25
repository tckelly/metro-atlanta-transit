import { describe, it, expect } from 'vitest';

import { detectPlatform } from './detectPlatform';

describe('detectPlatform', () => {
  it('detects iPhone', () => {
    expect(
      detectPlatform({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe('ios');
  });

  it('detects iPad (legacy UA that includes "iPad")', () => {
    expect(
      detectPlatform({
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPad',
        maxTouchPoints: 5,
      }),
    ).toBe('ios');
  });

  it('detects iPad masquerading as MacIntel (iPadOS 13+)', () => {
    // Modern iPadOS reports as desktop Safari unless we also check
    // touch points. Real Macs have maxTouchPoints === 0; iPads have > 0.
    expect(
      detectPlatform({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe('ios');
  });

  it('detects Android phone', () => {
    expect(
      detectPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBe('android');
  });

  it('detects Android tablet', () => {
    expect(
      detectPlatform({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/120.0',
        platform: 'Linux x86_64',
        maxTouchPoints: 5,
      }),
    ).toBe('android');
  });

  it('returns "desktop" for a real Mac (no touch)', () => {
    expect(
      detectPlatform({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe('desktop');
  });

  it('returns "desktop" for Windows', () => {
    expect(
      detectPlatform({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
        platform: 'Win32',
        maxTouchPoints: 0,
      }),
    ).toBe('desktop');
  });
});
