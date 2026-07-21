import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ListItem } from './ListItem';

describe('ListItem', () => {
  it('renders the title', () => {
    render(<ListItem title="Virginia Ave NE @ Maryland Ave NE" />);
    expect(screen.getByText('Virginia Ave NE @ Maryland Ave NE')).toBeInTheDocument();
  });

  it('renders the secondary slot when provided and omits it otherwise', () => {
    const { rerender } = render(
      <ListItem title="Virginia Ave" secondary="11 → Collier Rd" />,
    );
    expect(screen.getByText('11 → Collier Rd')).toBeInTheDocument();

    rerender(<ListItem title="Virginia Ave" />);
    expect(screen.queryByText('11 → Collier Rd')).not.toBeInTheDocument();
  });

  it('renders the trailing slot when provided', () => {
    render(<ListItem title="Virginia Ave" trailing={<span>5 min walk</span>} />);
    expect(screen.getByText('5 min walk')).toBeInTheDocument();
  });

  it('renders the leading slot when provided', () => {
    render(<ListItem title="Route" leading={<span>11</span>} />);
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  // variant and interactive are visual-semantic variants (ADR-0009): they
  // select the container idiom (card vs divided-list) and the hover affordance.
  // Asserting the distinguishing class is warranted, same as ArrivalRow's variants.
  it('applies the card container in the card variant and not in the row variant', () => {
    const { container, rerender } = render(<ListItem title="x" variant="card" />);
    expect(container.firstChild).toHaveClass('border');

    rerender(<ListItem title="x" variant="row" />);
    expect(container.firstChild).not.toHaveClass('border');
  });

  it('adds a group-hover affordance only when interactive', () => {
    // interactive affordances are group-hover:* so they activate from a parent
    // wrapper marked `group` (the web package's <Link>), keeping routing out of
    // the library per ADR-0009.
    const { container, rerender } = render(
      <ListItem title="x" variant="card" interactive />,
    );
    expect(container.firstChild).toHaveClass('group-hover:border-primary');

    rerender(<ListItem title="x" variant="card" />);
    expect(container.firstChild).not.toHaveClass('group-hover:border-primary');
  });
});
