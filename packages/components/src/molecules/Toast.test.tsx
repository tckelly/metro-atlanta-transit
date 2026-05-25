import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { Toast } from './Toast';

describe('Toast', () => {
  it('renders the message inside a polite status region', () => {
    render(<Toast message="Removed Virginia Ave" />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Removed Virginia Ave');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('omits any action button when no action is supplied', () => {
    render(<Toast message="Saved" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders an action button when an action is supplied', () => {
    render(<Toast message="Removed Virginia Ave" action={{ label: 'Undo', onClick: () => {} }} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('invokes the action callback when the button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Toast message="Removed Virginia Ave" action={{ label: 'Undo', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call the callback when no click happens', () => {
    const onClick = vi.fn();
    render(<Toast message="Removed Virginia Ave" action={{ label: 'Undo', onClick }} />);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('positions itself fixed at the bottom so it floats above content', () => {
    render(<Toast message="Saved" />);
    expect(screen.getByRole('status')).toHaveClass('fixed', 'bottom-4');
  });
});
