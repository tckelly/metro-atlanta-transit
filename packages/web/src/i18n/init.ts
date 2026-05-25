/**
 * i18next initialization for the app. Side-effecting module — import
 * once (from `main.tsx` for the app, `test-setup.ts` for vitest) and
 * the global instance is ready everywhere `useTranslation()` runs.
 *
 * Strategy:
 *  - Resources are imported directly. No async file loading; i18next
 *    is synchronously ready after init() returns.
 *  - Initial language: localStorage > browser preference > English.
 *  - Side effect on language change: keep <html lang> in sync so
 *    screen readers pick the right voice and search engines /
 *    translation tools read the correct content language.
 *
 * See ADR-0003 for why translation lives entirely in `@atl-transit/web`,
 * never in `@atl-transit/components`.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';

export const LOCALE_STORAGE_KEY = 'atl-transit:locale';

export type Locale = 'en' | 'es';

const SUPPORTED: readonly Locale[] = ['en', 'es'];

function isSupported(value: string): value is Locale {
  return (SUPPORTED as readonly string[]).includes(value);
}

function detectInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved !== null && isSupported(saved)) return saved;
  }
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language.toLowerCase().split('-')[0] ?? 'en';
    if (isSupported(browserLang)) return browserLang;
  }
  return 'en';
}

const initialLocale = detectInitialLocale();

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED,
  interpolation: {
    // React escapes everything before render, so i18next's default
    // string escaping would double-escape.
    escapeValue: false,
  },
  // The `_one`/`_other` suffix scheme is standard react-i18next plural
  // resolution; no extra config needed beyond passing `{ count }`.
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
  i18next.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });
}

export { i18next };
