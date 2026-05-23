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

  it('uses currentColor so the parent can color it via Tailwind text-* classes', () => {
    const { container } = render(<Icon name="clock" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });
});
