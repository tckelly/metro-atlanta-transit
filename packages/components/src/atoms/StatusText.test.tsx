import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StatusText } from './StatusText';

describe('StatusText', () => {
  it('renders its children', () => {
    render(<StatusText severity="success">3 min</StatusText>);
    expect(screen.getByText('3 min')).toBeInTheDocument();
  });

  // The severity→color mapping is this atom's entire contract (it exists to
  // retire the duplicated `severity → text-status-*` maps per ADR-0009), so
  // asserting the visual-semantic class is warranted here — same rationale as
  // ArrivalRow's strikethrough test.
  it('maps each severity to its status color', () => {
    const { rerender } = render(<StatusText severity="success">x</StatusText>);
    expect(screen.getByText('x')).toHaveClass('text-status-live');

    rerender(<StatusText severity="warning">x</StatusText>);
    expect(screen.getByText('x')).toHaveClass('text-status-warn');

    rerender(<StatusText severity="danger">x</StatusText>);
    expect(screen.getByText('x')).toHaveClass('text-status-cancelled');

    rerender(<StatusText severity="neutral">x</StatusText>);
    expect(screen.getByText('x')).toHaveClass('text-fg');
  });

  it('is normal weight by default and semibold when asked', () => {
    const { rerender } = render(<StatusText severity="neutral">x</StatusText>);
    expect(screen.getByText('x')).not.toHaveClass('font-semibold');

    rerender(
      <StatusText severity="neutral" weight="semibold">
        x
      </StatusText>,
    );
    expect(screen.getByText('x')).toHaveClass('font-semibold');
  });
});
