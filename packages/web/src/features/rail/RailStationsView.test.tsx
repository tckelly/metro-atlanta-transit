import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { RailStationsView } from './RailStationsView';
import type { RailStation } from './railStations';

function station(overrides: Partial<RailStation> = {}): RailStation {
  return {
    name: 'FIVE POINTS STATION',
    displayName: 'Five Points Station',
    lines: ['RED', 'GOLD', 'BLUE', 'GREEN'],
    ...overrides,
  };
}

function renderView(props: Partial<ComponentProps<typeof RailStationsView>> = {}) {
  return render(
    <MemoryRouter>
      <RailStationsView
        status="success"
        stations={[station()]}
        error={null}
        onRefresh={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('RailStationsView', () => {
  it('renders each station as a link to its station-detail page', () => {
    renderView({
      stations: [
        station({ name: 'AIRPORT STATION', displayName: 'Airport Station', lines: ['RED', 'GOLD'] }),
        station({
          name: 'FIVE POINTS STATION',
          displayName: 'Five Points Station',
          lines: ['RED'],
        }),
      ],
    });

    const airport = screen.getByRole('link', { name: /Airport Station/ });
    expect(airport).toHaveAttribute('href', '/station/AIRPORT%20STATION');
    const fivePoints = screen.getByRole('link', { name: /Five Points Station/ });
    expect(fivePoints).toHaveAttribute('href', '/station/FIVE%20POINTS%20STATION');
  });

  it('names the lines serving each station', () => {
    renderView({
      stations: [station({ displayName: 'Airport Station', lines: ['RED', 'GOLD'] })],
    });
    expect(screen.getByText(/Red/)).toBeInTheDocument();
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
  });

  it('shows a loading status while loading', () => {
    renderView({ status: 'loading', stations: [] });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error message on error', () => {
    renderView({ status: 'error', stations: [], error: new Error('boom') });
    expect(screen.getByText(/Couldn.t load/i)).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is pressed', () => {
    const onRefresh = vi.fn();
    renderView({ onRefresh });
    screen.getByRole('button', { name: /refresh/i }).click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
