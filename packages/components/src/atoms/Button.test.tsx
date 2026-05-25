import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { Button } from './Button';

describe('Button', () => {
  it('renders its children inside a real <button>', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('defaults to type="button" so it does not accidentally submit forms', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('lets the caller override the type', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('forwards onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tap</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards aria-pressed for toggle buttons', () => {
    render(
      <Button variant="icon" aria-pressed aria-label="Toggle star">
        ★
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Toggle star' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('honors the disabled prop', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('variant="primary" uses the primary outline treatment', () => {
    render(<Button variant="primary">Find stops</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-primary', 'text-primary');
  });

  it('variant="neutral" uses the divider outline treatment', () => {
    render(<Button variant="neutral">Try again</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-divider', 'text-fg');
  });

  it('variant="icon" is a 44×44 square hit target', () => {
    render(
      <Button variant="icon" aria-label="Refresh">
        ↻
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-11', 'w-11');
  });

  it('default variant is "neutral"', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-divider');
  });

  it('appends caller-supplied className to the variant classes', () => {
    render(
      <Button variant="icon" className="text-status-warn" aria-label="Starred">
        ★
      </Button>,
    );
    const button = screen.getByRole('button');
    // Both the variant class and the caller class are present.
    expect(button).toHaveClass('h-11');
    expect(button).toHaveClass('text-status-warn');
  });

  it('always includes the focus-visible ring so keyboard users see focus', () => {
    render(<Button>Focusable</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-primary');
  });

  it('neutral hover state is surface-independent — promotes border to primary', () => {
    // Surface-dependent hovers (bg-surface, bg-surface-elevated) lose
    // contrast when the button is nested inside a MessageCard of the
    // same color. A primary-colored border is visible regardless of
    // the surrounding surface.
    render(<Button variant="neutral">Try again</Button>);
    expect(screen.getByRole('button')).toHaveClass('hover:border-primary');
  });

  it('primary hover state is surface-independent — primary-tinted overlay', () => {
    render(<Button variant="primary">Find stops</Button>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-primary/10');
  });
});
