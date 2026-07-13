import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DirectionLabel } from './DirectionLabel';

const VALUE = { visible: '11 → Collier Rd', label: 'Route 11 toward Collier Rd' };

describe('DirectionLabel', () => {
  it('shows the visible glyph text', () => {
    render(<DirectionLabel value={VALUE} />);
    expect(screen.getByText('11 → Collier Rd')).toBeInTheDocument();
  });

  it('exposes the spoken label as the accessible name, not the "→" glyph', () => {
    render(<DirectionLabel value={VALUE} />);
    // The accessible name is the spoken form; a screen reader never voices "→".
    expect(screen.getByText('11 → Collier Rd')).toHaveAccessibleName('Route 11 toward Collier Rd');
  });

  it('renders as a span by default and as the requested element otherwise', () => {
    const { rerender } = render(<DirectionLabel value={VALUE} />);
    expect(screen.getByText('11 → Collier Rd').tagName).toBe('SPAN');

    rerender(<DirectionLabel value={VALUE} as="p" className="mt-0.5" />);
    const p = screen.getByText('11 → Collier Rd');
    expect(p.tagName).toBe('P');
    expect(p).toHaveClass('mt-0.5');

    // h2 for the stop-detail route-group header — still one accessible-name
    // contract, now on a heading.
    rerender(<DirectionLabel value={VALUE} as="h2" />);
    const h = screen.getByText('11 → Collier Rd');
    expect(h.tagName).toBe('H2');
    expect(h).toHaveAccessibleName('Route 11 toward Collier Rd');
  });
});
