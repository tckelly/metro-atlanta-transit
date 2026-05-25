import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { formatTime, useFormatTime } from './formatters';
import { i18next } from './init';
import { SettingsProvider, type SettingsStorage } from '../features/settings/SettingsContext';

// 2026-05-22 14:45:00 UTC = 10:45 EDT (10:45 AM in 12h, 10:45 in 24h)
const SAMPLE_UNIX_SEC = 1779461100;

function memoryStorage(seed: Record<string, string> = {}): SettingsStorage {
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

function wrapperWith(storage: SettingsStorage = memoryStorage()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SettingsProvider storage={storage}>{children}</SettingsProvider>;
  };
}

beforeEach(async () => {
  // Reset language between tests so one test's changeLanguage doesn't
  // bleed into the next. The init module set 'en' on first load.
  await i18next.changeLanguage('en');
});

afterEach(async () => {
  await i18next.changeLanguage('en');
});

describe('formatTime — pure function', () => {
  it('formats in 24-hour when hour12 is false', () => {
    const out = formatTime(SAMPLE_UNIX_SEC, {
      locale: 'en',
      hour12: false,
      timeZone: 'America/New_York',
    });
    expect(out).toBe('10:45');
  });

  it('formats in 12-hour when hour12 is true', () => {
    const out = formatTime(SAMPLE_UNIX_SEC, {
      locale: 'en',
      hour12: true,
      timeZone: 'America/New_York',
    });
    // Allow either narrow no-break space or regular space between time and meridiem.
    expect(out.replace(/\s/g, ' ')).toMatch(/^10:45 ?AM$/i);
  });

  it("lets the locale decide when hour12 is undefined ('auto')", () => {
    // en-US defaults to 12h.
    const en = formatTime(SAMPLE_UNIX_SEC, { locale: 'en-US', timeZone: 'America/New_York' });
    expect(en.replace(/\s/g, ' ')).toMatch(/AM|PM/i);

    // es defaults to 24h.
    const es = formatTime(SAMPLE_UNIX_SEC, { locale: 'es', timeZone: 'America/New_York' });
    expect(es).not.toMatch(/AM|PM/i);
  });

  it('honors the configured timezone', () => {
    // Same moment, different zone — formatted hours differ.
    const eastern = formatTime(SAMPLE_UNIX_SEC, {
      locale: 'en',
      hour12: false,
      timeZone: 'America/New_York',
    });
    const pacific = formatTime(SAMPLE_UNIX_SEC, {
      locale: 'en',
      hour12: false,
      timeZone: 'America/Los_Angeles',
    });
    expect(eastern).not.toBe(pacific);
  });
});

describe('useFormatTime — hook', () => {
  it("uses clockFormat='12h' from settings", () => {
    const storage = memoryStorage({
      'atl-transit:settings:v1': JSON.stringify({ clockFormat: '12h' }),
    });
    const { result } = renderHook(() => useFormatTime(), { wrapper: wrapperWith(storage) });
    expect(result.current(SAMPLE_UNIX_SEC).replace(/\s/g, ' ')).toMatch(/AM|PM/i);
  });

  it("uses clockFormat='24h' from settings", () => {
    const storage = memoryStorage({
      'atl-transit:settings:v1': JSON.stringify({ clockFormat: '24h' }),
    });
    const { result } = renderHook(() => useFormatTime(), { wrapper: wrapperWith(storage) });
    const out = result.current(SAMPLE_UNIX_SEC);
    expect(out).not.toMatch(/AM|PM/i);
    expect(out).toBe('10:45');
  });

  it("clockFormat='auto' follows the active locale", async () => {
    await i18next.changeLanguage('es');
    const storage = memoryStorage(); // defaults to 'auto'
    const { result } = renderHook(() => useFormatTime(), { wrapper: wrapperWith(storage) });
    // Spanish defaults to 24-hour.
    expect(result.current(SAMPLE_UNIX_SEC)).not.toMatch(/AM|PM/i);
  });

  it('returns a stable function reference across renders when inputs are unchanged', () => {
    const storage = memoryStorage();
    const { result, rerender } = renderHook(() => useFormatTime(), {
      wrapper: wrapperWith(storage),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
