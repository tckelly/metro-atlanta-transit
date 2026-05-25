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
import { Button, MessageCard } from '@atl-transit/components';

import { useInstallPrompt, type InstallEnvironment } from './useInstallPrompt';

export interface InstallPromptProps {
  environment?: InstallEnvironment;
}

export function InstallPrompt({ environment }: InstallPromptProps = {}) {
  const state = useInstallPrompt(environment);

  if (state.kind === 'hidden') return null;

  if (state.kind === 'ios') {
    return <IOSInstallInstructions />;
  }

  return (
    <MessageCard
      title="Install Atlanta Transit"
      body="Add the app to your home screen for one-tap arrivals."
      action={
        <Button variant="primary" onClick={() => void state.prompt()}>
          Install app
        </Button>
      }
    />
  );
}

function IOSInstallInstructions() {
  return (
    <MessageCard
      title="Install on iPhone or iPad"
      body={
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            Tap the <strong>Share</strong> button at the bottom of Safari.
          </li>
          <li>
            Scroll down and choose <strong>Add to Home Screen</strong>.
          </li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
      }
    />
  );
}
