import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { ArrivalRow } from './ArrivalRow';

function renderInList(...children: React.ReactNode[]) {
  return render(<ul>{children}</ul>);
}

describe('ArrivalRow', () => {
  it('renders the primary text as the headline', () => {
    renderInList(<ArrivalRow key="a" primaryText="3 min" severity="success" />);
    expect(screen.getByText('3 min')).toBeInTheDocument();
  });

  it('renders secondary text when provided', () => {
    renderInList(
      <ArrivalRow
        key="a"
        primaryText="3 min"
        secondaryText="Scheduled 12:34 · Seats available"
        severity="success"
      />,
    );
    expect(screen.getByText(/Seats available/)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled 12:34/)).toBeInTheDocument();
  });

  it('omits the secondary line entirely when no secondaryText is given', () => {
    const { container } = renderInList(
      <ArrivalRow key="a" primaryText="3 min" severity="success" />,
    );
    // Only one text node under the li
    const li = container.querySelector('li');
    expect(li).toBeInTheDocument();
    expect(within(li!).queryByText(/Scheduled/)).not.toBeInTheDocument();
  });

  it('renders as a list item so screen readers announce the parent <ul> as a list', () => {
    const { container } = renderInList(
      <ArrivalRow key="a" primaryText="3 min" severity="success" />,
    );
    expect(container.querySelector('li')).toBeInTheDocument();
  });

  it('renders an icon when provided and marks it decorative', () => {
    const { container } = renderInList(
      <ArrivalRow key="a" primaryText="3 min" severity="success" icon="clock" />,
    );
    const svg = container.querySelector('svg[data-icon="clock"]');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits the icon entirely when not provided', () => {
    const { container } = renderInList(
      <ArrivalRow key="a" primaryText="3 min" severity="success" />,
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('applies strikethrough decoration when primaryStyle is strikethrough', () => {
    renderInList(
      <ArrivalRow
        key="a"
        primaryText="Cancelled"
        severity="danger"
        primaryStyle="strikethrough"
      />,
    );
    expect(screen.getByText('Cancelled')).toHaveClass('line-through');
  });

  it('renders the four documented status variants without crashing', () => {
    // live on-time
    const { rerender } = renderInList(
      <ArrivalRow key="a" primaryText="3 min" severity="success" icon="clock" />,
    );
    expect(screen.getByText('3 min')).toBeInTheDocument();

    // live delayed
    rerender(
      <ul>
        <ArrivalRow primaryText="8 min" severity="warning" icon="clock" />
      </ul>,
    );
    expect(screen.getByText('8 min')).toBeInTheDocument();

    // cancelled
    rerender(
      <ul>
        <ArrivalRow
          primaryText="Cancelled"
          severity="danger"
          icon="warning"
          primaryStyle="strikethrough"
        />
      </ul>,
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();

    // no live data
    rerender(
      <ul>
        <ArrivalRow primaryText="12:34" severity="neutral" icon="clock" />
      </ul>,
    );
    expect(screen.getByText('12:34')).toBeInTheDocument();
  });
});
