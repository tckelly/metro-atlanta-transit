import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  SettingsProvider,
  useSettings,
  SETTINGS_STORAGE_KEY,
  type SettingsStorage,
} from './SettingsContext';

function makeMemoryStorage(seed: Record<string, string> = {}): SettingsStorage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function wrapperWith(storage: SettingsStorage) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SettingsProvider storage={storage}>{children}</SettingsProvider>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsContext — initial load', () => {
  it("defaults clockFormat to 'auto' when no value is stored", () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: wrapperWith(makeMemoryStorage()),
    });
    expect(result.current.clockFormat).toBe('auto');
  });

  it('loads a stored valid clockFormat', () => {
    const storage = makeMemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ clockFormat: '24h' }),
    });
    const { result } = renderHook(() => useSettings(), { wrapper: wrapperWith(storage) });
    expect(result.current.clockFormat).toBe('24h');
  });

  it('falls back to defaults when stored JSON is malformed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = makeMemoryStorage({ [SETTINGS_STORAGE_KEY]: '{not-json' });
    const { result } = renderHook(() => useSettings(), { wrapper: wrapperWith(storage) });
    expect(result.current.clockFormat).toBe('auto');
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to defaults when stored shape fails Zod validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = makeMemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ clockFormat: 'banana' }),
    });
    const { result } = renderHook(() => useSettings(), { wrapper: wrapperWith(storage) });
    expect(result.current.clockFormat).toBe('auto');
    expect(warn).toHaveBeenCalled();
  });
});

describe('SettingsContext — mutations', () => {
  it("setClockFormat updates state and persists", () => {
    const storage = makeMemoryStorage();
    const { result } = renderHook(() => useSettings(), { wrapper: wrapperWith(storage) });

    act(() => {
      result.current.setClockFormat('12h');
    });

    expect(result.current.clockFormat).toBe('12h');
    const persisted = storage.getItem(SETTINGS_STORAGE_KEY) ?? '';
    expect(JSON.parse(persisted)).toEqual({ clockFormat: '12h' });
  });

  it('accepts each of the three valid values', () => {
    const storage = makeMemoryStorage();
    const { result } = renderHook(() => useSettings(), { wrapper: wrapperWith(storage) });

    for (const v of ['12h', '24h', 'auto'] as const) {
      act(() => {
        result.current.setClockFormat(v);
      });
      expect(result.current.clockFormat).toBe(v);
    }
  });
});

describe('SettingsContext — provider contract', () => {
  it('throws when useSettings is called outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSettings())).toThrow(/SettingsProvider/);
    spy.mockRestore();
  });
});

beforeEach(() => {});
