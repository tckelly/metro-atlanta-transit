/**
 * Detect the user's platform from `navigator` properties. Pure
 * function so tests pass fake probes without stubbing globals.
 *
 * iPadOS 13+ reports the same userAgent and platform as macOS by
 * default, so the touch-points check is the standard heuristic to
 * distinguish them — a real Mac has `maxTouchPoints === 0`.
 */

export type Platform = 'ios' | 'android' | 'desktop';

export interface PlatformProbe {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

export function detectPlatform(probe: PlatformProbe): Platform {
  const ua = probe.userAgent;
  const plat = probe.platform ?? '';
  const touches = probe.maxTouchPoints ?? 0;

  if (/iPhone|iPad|iPod/.test(ua) || /iPhone|iPad|iPod/.test(plat)) {
    return 'ios';
  }
  // iPadOS 13+ masquerade
  if (plat === 'MacIntel' && touches > 1) {
    return 'ios';
  }
  if (/Android/.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

/**
 * Heuristic: does the UA suggest a Chromium-based browser?
 *
 * Chrome, Samsung Internet, Edge Android, Brave, and Opera all
 * advertise `Chrome/X.Y` in their UA strings (alongside their own
 * marker) and fire `beforeinstallprompt`. Firefox does not include
 * `Chrome/` and does not fire the event — those users need a manual
 * "install via your browser's menu" fallback instead.
 */
export function isLikelyChromium(probe: Pick<PlatformProbe, 'userAgent'>): boolean {
  return /\bChrome\//.test(probe.userAgent);
}
