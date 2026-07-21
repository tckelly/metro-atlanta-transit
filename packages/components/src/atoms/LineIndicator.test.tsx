import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LineIndicator } from './LineIndicator';

describe('LineIndicator', () => {
  it('renders the line-name label so it, not color, carries the meaning', () => {
    render(<LineIndicator line="red">Red Line</LineIndicator>);
    expect(screen.getByText('Red Line')).toBeInTheDocument();
  });

  // The color swatch is redundant reinforcement, never the sole signal — vital
  // for the Red/Green colour-vision-deficiency pair. So it must be hidden from
  // the accessibility tree, leaving the label as the announced content.
  it('hides the color swatch from screen readers', () => {
    const { container } = render(<LineIndicator line="green">Green Line</LineIndicator>);
    const swatch = container.querySelector('[aria-hidden="true"]');
    expect(swatch).not.toBeNull();
  });

  // Mapping a line to its brand color token is this atom's entire contract, so
  // asserting the visual-semantic class is warranted (same rationale as
  // StatusText's severity→color test).
  it('maps each line to its brand color token', () => {
    const cases: Array<[Parameters<typeof LineIndicator>[0]['line'], string]> = [
      ['red', 'bg-line-red'],
      ['gold', 'bg-line-gold'],
      ['blue', 'bg-line-blue'],
      ['green', 'bg-line-green'],
      ['neutral', 'bg-fg-muted'],
    ];
    for (const [line, expectedClass] of cases) {
      const { container, unmount } = render(<LineIndicator line={line}>label</LineIndicator>);
      const swatch = container.querySelector('[aria-hidden="true"]');
      expect(swatch).toHaveClass(expectedClass);
      unmount();
    }
  });
});
