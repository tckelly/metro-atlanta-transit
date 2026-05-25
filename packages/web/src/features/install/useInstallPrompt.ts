/**
 * Surfaces whether the app can be installed as a PWA on the current
 * device, and how.
 *
 * Three outcomes via the returned discriminated state:
 * - `hidden`  — already installed (standalone), or no install path
 * - `ios`     — running iOS Safari; show the manual "Add to Home Screen"
 *               instructions card (iOS doesn't fire any prompt event)
 * - `native`  — `beforeinstallprompt` has fired and `prompt()` will
 *               trigger the browser's native install dialog
 *
 * The environment is dependency-injected so tests can drive the hook
 * with synthetic navigators and dispatch events through a fake
 * EventTarget. Default uses `window` + `navigator` + `window.matchMedia`.
 */
import { useEffect, useState } from 'react';

import { detectPlatform, type PlatformProbe } from './detectPlatform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export interface InstallEnvironment {
  /** Subset of `navigator` used for platform + standalone detection. */
  navigator: PlatformProbe & { standalone?: boolean };
  /** Like `window.matchMedia`; only `matches` is read. */
  matchMedia: (query: string) => { matches: boolean };
  /** Source of the `beforeinstallprompt` event — defaults to `window`. */
  eventTarget: EventTarget;
}

export type InstallState =
  | { kind: 'hidden' }
  | { kind: 'ios' }
  | { kind: 'native'; prompt: () => Promise<void> };

function defaultEnvironment(): InstallEnvironment {
  if (typeof window === 'undefined') {
    // Server / non-browser runtime — produce a probe that resolves
    // to "hidden" without touching globals.
    return {
      navigator: { userAgent: '' },
      matchMedia: () => ({ matches: false }),
      eventTarget: new EventTarget(),
    };
  }
  // Feature-detect matchMedia. Real browsers always have it; jsdom
  // does not. Fall back to a non-matching shim so a11y tests can
  // render this hook's consumers without a test-side polyfill.
  const mql =
    typeof window.matchMedia === 'function'
      ? (q: string) => window.matchMedia(q)
      : () => ({ matches: false });
  return {
    navigator: window.navigator,
    matchMedia: mql,
    eventTarget: window,
  };
}

function isStandalone(env: InstallEnvironment): boolean {
  if (env.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS exposes a non-standard `navigator.standalone` boolean.
  return env.navigator.standalone === true;
}

export function useInstallPrompt(envOverride?: InstallEnvironment): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  const env = envOverride ?? defaultEnvironment();

  useEffect(() => {
    if (isStandalone(env)) return;
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    env.eventTarget.addEventListener('beforeinstallprompt', handler);
    return () => {
      env.eventTarget.removeEventListener('beforeinstallprompt', handler);
    };
  }, [env]);

  if (isStandalone(env)) return { kind: 'hidden' };
  if (deferred !== null) {
    return {
      kind: 'native',
      prompt: async () => {
        await deferred.prompt();
        // beforeinstallprompt is one-shot per page load — drop the
        // deferred event so the UI clears and we don't try to reuse it.
        setDeferred(null);
      },
    };
  }
  if (detectPlatform(env.navigator) === 'ios') return { kind: 'ios' };
  return { kind: 'hidden' };
}
