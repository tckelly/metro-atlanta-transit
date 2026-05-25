import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MessageCard } from './MessageCard';

describe('MessageCard', () => {
  it('renders the body content', () => {
    render(<MessageCard body="One moment." />);
    expect(screen.getByText('One moment.')).toBeInTheDocument();
  });

  it('renders the title as <h2> by default', () => {
    render(<MessageCard title="Loading…" body="One moment." />);
    expect(screen.getByRole('heading', { level: 2, name: 'Loading…' })).toBeInTheDocument();
  });

  it('renders the title as the element specified by titleAs', () => {
    const { container } = render(
      <MessageCard title="No favorites yet" titleAs="p" body="Find a stop below." />,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.querySelector('p')).toHaveTextContent('No favorites yet');
  });

  it('omits the title element entirely when no title is given', () => {
    render(<MessageCard body="Couldn’t reach the network." />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders the action slot when provided', () => {
    render(<MessageCard body="Try again later." action={<button>Try again</button>} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('omits the action wrapper when no action is given', () => {
    const { container } = render(<MessageCard body="Just a body." />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders rich React node bodies (not just strings)', () => {
    render(
      <MessageCard
        body={
          <p>
            <strong>Heads up:</strong> location is required.
          </p>
        }
      />,
    );
    expect(screen.getByText('Heads up:')).toBeInTheDocument();
  });

  it('applies the standard surface treatment to the wrapper', () => {
    const { container } = render(<MessageCard body="x" />);
    const card = container.firstElementChild;
    expect(card).toHaveClass(
      'rounded',
      'border',
      'border-divider',
      'bg-surface-elevated',
      'p-4',
    );
  });
});
