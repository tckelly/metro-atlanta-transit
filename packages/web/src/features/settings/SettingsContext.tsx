/**
 * User-pref state for the app — currently just `clockFormat`, but
 * shaped so future prefs (theme, units, defaults) extend the same
 * provider without consumer churn.
 *
 * localStorage holds the single canonical JSON blob. Zod validates on
 * read so a corrupted entry or a shape change can't crash the app —
 * we drop back to defaults and log.
 *
 * Storage is injectable so tests run against an in-memory map.
 */
import { z } from 'zod';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export const SETTINGS_STORAGE_KEY = 'atl-transit:settings:v1';

const ClockFormatSchema = z.enum(['12h', '24h', 'auto']);
export type ClockFormat = z.infer<typeof ClockFormatSchema>;

const SettingsSchema = z.object({
  clockFormat: ClockFormatSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

const DEFAULTS: Settings = { clockFormat: 'auto' };

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): SettingsStorage {
  return globalThis.localStorage;
}

function loadSettings(storage: SettingsStorage): Settings {
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (raw === null) return DEFAULTS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[settings] dropping malformed JSON in ${SETTINGS_STORAGE_KEY}:`, err);
    return DEFAULTS;
  }

  const result = SettingsSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[settings] dropping value in ${SETTINGS_STORAGE_KEY} that failed validation:`,
      result.error.issues,
    );
    return DEFAULTS;
  }
  return result.data;
}

function saveSettings(settings: Settings, storage: SettingsStorage): void {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export interface SettingsContextValue extends Settings {
  setClockFormat: (value: ClockFormat) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export interface SettingsProviderProps {
  children: ReactNode;
  /** Override the persistence layer. Defaults to `localStorage`. */
  storage?: SettingsStorage;
}

export function SettingsProvider({
  children,
  storage = defaultStorage(),
}: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));

  const setClockFormat = useCallback(
    (value: ClockFormat) => {
      setSettings((current) => {
        const next: Settings = { ...current, clockFormat: value };
        saveSettings(next, storage);
        return next;
      });
    },
    [storage],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ ...settings, setClockFormat }),
    [settings, setClockFormat],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (ctx === null) {
    throw new Error('useSettings must be called inside a SettingsProvider.');
  }
  return ctx;
}
