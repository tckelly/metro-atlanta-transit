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
