import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useInstallPrompt, type InstallEnvironment } from './useInstallPrompt';

function makeEnv(overrides: Partial<InstallEnvironment> = {}): InstallEnvironment {
  const eventTarget = new EventTarget();
  return {
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
      platform: 'Win32',
      maxTouchPoints: 0,
    },
    matchMedia: () => ({ matches: false }),
    eventTarget,
    ...overrides,
  };
}

function makeBeforeInstallPromptEvent(prompt: () => Promise<void>): Event {
  const ev = new Event('beforeinstallprompt');
  Object.assign(ev, { prompt });
  return ev;
}

beforeEach(() => {
  // Keep React DOM noise out of the test output when we exercise the
  // hook outside jsdom's window.
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useInstallPrompt — initial state', () => {
  it('returns "hidden" when the app is already running in standalone mode', () => {
    const env = makeEnv({
      matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }),
    });
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('hidden');
  });

  it('returns "hidden" when iOS Safari reports standalone', () => {
    const env = makeEnv({
      navigator: {
        userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605',
        platform: 'iPhone',
        maxTouchPoints: 5,
        standalone: true,
      },
    });
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('hidden');
  });

  it('returns "ios" when running iOS Safari (not yet installed)', () => {
    const env = makeEnv({
      navigator: {
        userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605',
        platform: 'iPhone',
        maxTouchPoints: 5,
      },
    });
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('ios');
  });

  it('returns "hidden" on Chromium Android until beforeinstallprompt fires', () => {
    // Chrome / Samsung Internet / Edge / Brave / Opera will fire the
    // event; we suppress the generic instructions card until we know
    // the native flow isn't coming.
    const env = makeEnv({
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0',
        platform: 'Linux',
        maxTouchPoints: 5,
      },
    });
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('hidden');
  });

  it('returns "android-generic" on non-Chromium Android (e.g. Firefox)', () => {
    // Firefox on Android doesn't fire `beforeinstallprompt`, so we show
    // a generic "install via your browser's menu" card instead of
    // leaving the rider with no install path at all.
    const env = makeEnv({
      navigator: {
        userAgent:
          'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
        platform: 'Linux',
        maxTouchPoints: 5,
      },
    });
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('android-generic');
  });

  it('returns "hidden" on desktop until beforeinstallprompt fires', () => {
    const env = makeEnv();
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('hidden');
  });
});

describe('useInstallPrompt — beforeinstallprompt flow', () => {
  it('transitions to "native" when the event fires, exposing a prompt callback', () => {
    const env = makeEnv();
    const { result } = renderHook(() => useInstallPrompt(env));
    expect(result.current.kind).toBe('hidden');

    const promptFn = vi.fn(async () => {});
    act(() => {
      env.eventTarget.dispatchEvent(makeBeforeInstallPromptEvent(promptFn));
    });

    expect(result.current.kind).toBe('native');
  });

  it('prompt() invokes the deferred event\'s prompt method', async () => {
    const env = makeEnv();
    const { result } = renderHook(() => useInstallPrompt(env));

    const promptFn = vi.fn(async () => {});
    act(() => {
      env.eventTarget.dispatchEvent(makeBeforeInstallPromptEvent(promptFn));
    });

    const state = result.current;
    if (state.kind !== 'native') throw new Error('expected native state');
    await act(async () => {
      await state.prompt();
    });

    expect(promptFn).toHaveBeenCalledTimes(1);
  });

  it('clears state back to hidden after prompt() resolves (one-shot)', async () => {
    // The browser only fires beforeinstallprompt once per page load,
    // so after prompting we should drop back to hidden — the deferred
    // event is no longer usable.
    const env = makeEnv();
    const { result } = renderHook(() => useInstallPrompt(env));

    act(() => {
      env.eventTarget.dispatchEvent(makeBeforeInstallPromptEvent(async () => {}));
    });
    const state = result.current;
    if (state.kind !== 'native') throw new Error('expected native state');

    await act(async () => {
      await state.prompt();
    });

    expect(result.current.kind).toBe('hidden');
  });

  it('removes the event listener on unmount', () => {
    const env = makeEnv();
    const addSpy = vi.spyOn(env.eventTarget, 'addEventListener');
    const removeSpy = vi.spyOn(env.eventTarget, 'removeEventListener');

    const { unmount } = renderHook(() => useInstallPrompt(env));
    expect(addSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
  });
});
