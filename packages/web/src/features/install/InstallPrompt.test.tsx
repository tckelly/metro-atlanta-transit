import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { InstallPrompt } from './InstallPrompt';
import type { InstallEnvironment } from './useInstallPrompt';

function envFor(opts: {
  platform: 'ios' | 'android' | 'android-firefox' | 'desktop';
  standalone?: boolean;
}): InstallEnvironment {
  const uaByPlatform = {
    ios: 'Mozilla/5.0 (iPhone) AppleWebKit/605',
    android: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0',
    'android-firefox':
      'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
    desktop: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
  };
  const platformByPlatform = {
    ios: 'iPhone',
    android: 'Linux',
    'android-firefox': 'Linux',
    desktop: 'Win32',
  };
  return {
    navigator: {
      userAgent: uaByPlatform[opts.platform],
      platform: platformByPlatform[opts.platform],
      maxTouchPoints: opts.platform === 'desktop' ? 0 : 5,
      standalone: opts.platform === 'ios' && opts.standalone === true,
    },
    matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' && opts.standalone === true }),
    eventTarget: new EventTarget(),
  };
}

describe('InstallPrompt', () => {
  it('renders nothing when already in standalone mode', () => {
    const { container } = render(
      <InstallPrompt environment={envFor({ platform: 'android', standalone: true })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders iOS instructions on iOS Safari (no native prompt available)', () => {
    render(<InstallPrompt environment={envFor({ platform: 'ios' })} />);
    expect(screen.getByText(/install on iphone/i)).toBeInTheDocument();
    // The instructions mention the Share button and "Add to Home Screen"
    expect(screen.getByText(/share/i)).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it('renders nothing on Android until beforeinstallprompt fires', () => {
    const { container } = render(
      <InstallPrompt environment={envFor({ platform: 'android' })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders generic browser-menu instructions on non-Chromium Android (e.g. Firefox)', () => {
    // Firefox on Android can install PWAs but only via the browser's
    // overflow menu — no JS API. The card points the rider there
    // instead of going silent.
    render(<InstallPrompt environment={envFor({ platform: 'android-firefox' })} />);
    expect(screen.getByText(/install atlanta transit/i)).toBeInTheDocument();
    expect(screen.getByText(/browser.*menu/i)).toBeInTheDocument();
  });

  it('renders an install button after beforeinstallprompt fires, and calls prompt()', async () => {
    const env = envFor({ platform: 'android' });
    render(<InstallPrompt environment={env} />);

    const promptFn = vi.fn(async () => {});
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt: promptFn });
    env.eventTarget.dispatchEvent(event);

    const button = await screen.findByRole('button', { name: /install/i });
    const user = userEvent.setup();
    await user.click(button);

    expect(promptFn).toHaveBeenCalledTimes(1);
  });
});
