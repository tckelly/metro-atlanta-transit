/**
 * Behavior tests for the cold-open loading shell.
 *
 * Visible only while `BundleGate` waits for `/gtfs/stops.json` and
 * `/gtfs/routes.json` on first-ever load. Replaces the previous
 * text-only `MessageCard` so the user sees the app brand and a content
 * shape immediately, instead of a centered "One moment." card.
 *
 * See `docs/launch-checklist.md` § "Cold-open loading state" for why
 * we chose a loading-only shell instead of a persistent app header.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LoadingShell } from './LoadingShell';

describe('LoadingShell', () => {
  it('shows the app brand so a cold open is recognizably this app', () => {
    render(<LoadingShell />);
    expect(screen.getByText('Atlanta Transit')).toBeInTheDocument();
  });

  it('exposes a polite live region announcing the load to screen readers', () => {
    render(<LoadingShell />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAccessibleName('Loading schedule data…');
  });

  it('does not render the brand as a heading — h1 belongs to the page that mounts after load', () => {
    render(<LoadingShell />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
