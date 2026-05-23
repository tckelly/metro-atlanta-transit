import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Hello</Badge>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies success severity classes', () => {
    render(<Badge severity="success">On time</Badge>);
    expect(screen.getByText('On time')).toHaveClass('bg-status-live/10', 'text-status-live');
  });

  it('applies warning severity classes', () => {
    render(<Badge severity="warning">Delayed</Badge>);
    expect(screen.getByText('Delayed')).toHaveClass('bg-status-warn/10', 'text-status-warn');
  });

  it('applies danger severity classes', () => {
    render(<Badge severity="danger">Cancelled</Badge>);
    expect(screen.getByText('Cancelled')).toHaveClass(
      'bg-status-cancelled/10',
      'text-status-cancelled',
    );
  });

  it('defaults to neutral severity when none is provided', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('bg-surface-elevated', 'text-fg-muted');
  });
});
