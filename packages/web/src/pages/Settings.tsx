/**
 * Settings page — user preferences live here.
 *
 * v1 surfaces:
 *  - Language (en / es) — routes through useLocale; persisted by i18n
 *    init module.
 *  - Clock format (12h / 24h / auto) — SettingsContext.
 *  - About card with attribution + disclaimer + version.
 *
 * Theme toggle is deferred — the existing index.html bootstrap script
 * already handles system / saved preference, but a UI control for it
 * would need a React-side mirror that the bootstrap also respects.
 * Marked as a future addition in roadmap.md.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCard } from '@atl-transit/components';

import { useLocale, type Locale } from '../i18n/useLocale';
import {
  useSettings,
  type ClockFormat,
} from '../features/settings/SettingsContext';

const APP_VERSION = '0.0.1'; // packages/web/package.json — bump on release

export function Settings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label={t('settings.backToHome')} className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="text-xl font-bold">{t('settings.title')}</h1>
      </header>

      <LanguageSection />
      <ClockFormatSection />
      <AboutSection />
    </div>
  );
}

function LanguageSection() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const options: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: t('settings.languageEnglish') },
    { value: 'es', label: t('settings.languageSpanish') },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('settings.languageHeading')}</h2>
      <RadioGroup
        legend={t('settings.languageHeading')}
        name="language"
        value={locale}
        options={options}
        onChange={setLocale}
      />
    </section>
  );
}

function ClockFormatSection() {
  const { t } = useTranslation();
  const { clockFormat, setClockFormat } = useSettings();

  const options: Array<{ value: ClockFormat; label: string }> = [
    { value: 'auto', label: t('settings.clockFormatAuto') },
    { value: '12h', label: t('settings.clockFormat12') },
    { value: '24h', label: t('settings.clockFormat24') },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('settings.clockFormatHeading')}</h2>
      <RadioGroup
        legend={t('settings.clockFormatHeading')}
        name="clockFormat"
        value={clockFormat}
        options={options}
        onChange={setClockFormat}
      />
    </section>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('settings.aboutHeading')}</h2>
      <MessageCard
        titleAs="p"
        title={t('settings.aboutVersion', { version: APP_VERSION })}
        body={
          <div className="space-y-2">
            <p>{t('settings.aboutBody')}</p>
            <p>{t('settings.aboutAttribution')}</p>
          </div>
        }
      />
    </section>
  );
}

/**
 * Visual-semantic radio group used for the two pref toggles. Uses a
 * fieldset/legend for built-in accessibility — screen readers
 * announce the group's purpose alongside each option's label.
 *
 * Generic over the value type so callers don't have to widen.
 */
function RadioGroup<TValue extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (next: TValue) => void;
}) {
  return (
    <fieldset className="rounded border border-divider bg-surface-elevated">
      <legend className="sr-only">{legend}</legend>
      <ul className="divide-y divide-divider">
        {options.map((opt) => (
          <li key={opt.value}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2 hover:bg-surface">
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => { onChange(opt.value); }}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-fg">{opt.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
