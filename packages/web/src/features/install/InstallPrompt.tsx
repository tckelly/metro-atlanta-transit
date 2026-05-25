/**
 * "Install this as an app" affordance. Two paths depending on the
 * platform — Android Chrome and friends fire `beforeinstallprompt`
 * and we can call the browser's native installer; iOS Safari needs
 * the user to add it manually, so we explain how.
 *
 * Renders nothing when already installed (standalone), when no path
 * is available (desktop browsers without PWA support), or before the
 * native event has fired on Android.
 *
 * `environment` is the same DI seam the hook uses — tests pass a
 * fake; the default is `window` / `navigator` / `window.matchMedia`.
 */
import { useTranslation } from 'react-i18next';
import { Button, MessageCard } from '@atl-transit/components';

import { useInstallPrompt, type InstallEnvironment } from './useInstallPrompt';

export interface InstallPromptProps {
  environment?: InstallEnvironment;
}

export function InstallPrompt({ environment }: InstallPromptProps = {}) {
  const { t } = useTranslation();
  const state = useInstallPrompt(environment);

  if (state.kind === 'hidden') return null;

  if (state.kind === 'ios') {
    return <IOSInstallInstructions />;
  }

  return (
    <MessageCard
      title={t('install.title')}
      body={t('install.body')}
      action={
        <Button variant="primary" onClick={() => void state.prompt()}>
          {t('install.button')}
        </Button>
      }
    />
  );
}

function IOSInstallInstructions() {
  const { t } = useTranslation();
  // Each step is split into lead / bold / trail so the bold span
  // survives translation without falling back to Trans components.
  return (
    <MessageCard
      title={t('install.iosTitle')}
      body={
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            {t('install.iosStep1Lead')} <strong>{t('install.iosStep1Bold')}</strong> {t('install.iosStep1Trail')}
          </li>
          <li>
            {t('install.iosStep2Lead')} <strong>{t('install.iosStep2Bold')}</strong>{t('install.iosStep2Trail')}
          </li>
          <li>
            {t('install.iosStep3Lead')} <strong>{t('install.iosStep3Bold')}</strong>{t('install.iosStep3Trail')}
          </li>
        </ol>
      }
    />
  );
}
