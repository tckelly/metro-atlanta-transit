import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Icon } from './Icon';

describe('Icon', () => {
  it('renders the clock icon and marks it aria-hidden', () => {
    const { container } = render(<Icon name="clock" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-icon', 'clock');
  });

  it('renders the warning icon', () => {
    const { container } = render(<Icon name="warning" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-icon', 'warning');
  });

  it('renders the refresh icon with actual path content', () => {
    const { container } = render(<Icon name="refresh" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'refresh');
    // Guard against a "type added but switch branch forgotten" regression —
    // the SVG must have at least one shape child.
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it('uses currentColor so the parent can color it via Tailwind text-* classes', () => {
    const { container } = render(<Icon name="clock" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });
});
