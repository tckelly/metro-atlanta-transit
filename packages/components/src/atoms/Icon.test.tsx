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

  it('renders the outline star icon with no fill', () => {
    const { container } = render(<Icon name="star" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'star');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it('renders the filled star icon with currentColor fill', () => {
    const { container } = render(<Icon name="star-filled" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'star-filled');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it('renders the search icon with actual path content', () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'search');
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it('renders the close icon with actual path content', () => {
    const { container } = render(<Icon name="close" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'close');
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it('renders the chevron-up icon with actual path content', () => {
    const { container } = render(<Icon name="chevron-up" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'chevron-up');
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it('renders the chevron-down icon with actual path content', () => {
    const { container } = render(<Icon name="chevron-down" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'chevron-down');
    expect(svg?.children.length).toBeGreaterThan(0);
  });
});
