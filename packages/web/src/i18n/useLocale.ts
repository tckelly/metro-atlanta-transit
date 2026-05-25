/**
 * Thin ergonomic wrapper around `react-i18next` for the Settings
 * page and anywhere else that needs to read or change the active
 * locale. Persists the choice to localStorage so the next visit
 * starts in the user's language without re-detecting from the
 * browser.
 *
 * Today this is a plain hook over `useTranslation()`. If we ever
 * grow the locale concern beyond strings — formatters, RTL, etc. —
 * a `LocaleProvider` slots in behind this same API without
 * consumer changes.
 */
import { useTranslation } from 'react-i18next';

import { LOCALE_STORAGE_KEY, type Locale } from './init';

export type { Locale };

export interface UseLocaleResult {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export function useLocale(): UseLocaleResult {
  const { i18n } = useTranslation();
  return {
    locale: i18n.language as Locale,
    setLocale: (locale) => {
      void i18n.changeLanguage(locale);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      }
    },
  };
}
