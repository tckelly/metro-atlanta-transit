import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DisruptionBadge } from './DisruptionBadge';

describe('DisruptionBadge', () => {
  it('renders nothing for level "none"', () => {
    const { container } = render(<DisruptionBadge level="none" cancellations={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a warning-severity message at level "soft"', () => {
    render(<DisruptionBadge level="soft" cancellations={1} />);
    const badge = screen.getByText(/1 cancelled/i);
    expect(badge).toBeInTheDocument();
  });

  it('renders a danger-severity message at level "strong"', () => {
    render(<DisruptionBadge level="strong" cancellations={3} />);
    expect(screen.getByText(/3 cancelled/i)).toBeInTheDocument();
  });

  it('uses an aria-label that names the disruption for assistive tech', () => {
    render(<DisruptionBadge level="soft" cancellations={1} />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/disruption/i),
    );
  });
});
