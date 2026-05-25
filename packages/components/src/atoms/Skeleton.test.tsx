import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a div with the pulsing animation', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('animate-pulse');
  });

  it('is aria-hidden so screen readers ignore the decorative shimmer', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the elevated surface token so it stands against the page background', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveClass('bg-surface-elevated');
  });

  it('appends caller className for sizing', () => {
    const { container } = render(<Skeleton className="h-6 w-32" />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('h-6');
    expect(el).toHaveClass('w-32');
    // Base classes are still present
    expect(el).toHaveClass('animate-pulse');
  });
});
