/**
 * Tests for the user-initiated refresh announcement.
 *
 * Fires only when the user has explicitly asked for a refresh (button
 * click or PTR gesture) — never on the silent 30s auto-poll. The
 * empty default means screen readers stay quiet between user actions.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RefreshAnnouncement } from './RefreshAnnouncement';

describe('RefreshAnnouncement', () => {
  it('renders a polite aria-live status region', () => {
    render(<RefreshAnnouncement active={false} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('is silent when active is false', () => {
    render(<RefreshAnnouncement active={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('renders the refresh message when active is true', () => {
    render(<RefreshAnnouncement active={true} />);
    expect(screen.getByRole('status').textContent).toMatch(/refreshing/i);
  });

  it('returns to silence when active toggles back to false', () => {
    const { rerender } = render(<RefreshAnnouncement active={true} />);
    rerender(<RefreshAnnouncement active={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});
