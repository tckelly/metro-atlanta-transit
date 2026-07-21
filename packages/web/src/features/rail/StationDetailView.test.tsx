import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { StationDetailView } from './StationDetailView';
import type { RailLineGroup } from './groupArrivalsByLineDestination';
import type { RailArrivalDTO } from '../../services/martaRail';

const NOW_SEC = 1779465600;

function dto(overrides: Partial<RailArrivalDTO> = {}): RailArrivalDTO {
  return {
    station: 'FIVE POINTS STATION',
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    trainId: 'T',
    arrivalTime: NOW_SEC + 240,
    isRealtime: true,
    delaySeconds: 0,
    ...overrides,
  };
}

function group(overrides: Partial<RailLineGroup> = {}): RailLineGroup {
  return {
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    arrivals: [dto()],
    ...overrides,
  };
}

function renderView(props: Partial<ComponentProps<typeof StationDetailView>> = {}) {
  return render(
    <MemoryRouter>
      <StationDetailView
        stationName="Five Points Station"
        status="success"
        groups={[group()]}
        lastUpdated={NOW_SEC}
        isStale={false}
        error={null}
        onRefresh={() => {}}
        nowSec={NOW_SEC}
        formatTime={(unixSec) => `clock:${String(unixSec)}`}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('StationDetailView', () => {
  it('shows the station name as the page heading', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Five Points Station' })).toBeInTheDocument();
  });

  it('renders a section per line+destination group, naming the line and destination', () => {
    renderView({
      groups: [
        group({ line: 'RED', destination: 'North Springs' }),
        group({
          line: 'GOLD',
          destination: 'Airport',
          arrivals: [dto({ trainId: 'B', line: 'GOLD', destination: 'Airport' })],
        }),
      ],
    });
    expect(screen.getByText(/Red/)).toBeInTheDocument();
    expect(screen.getByText(/North Springs/)).toBeInTheDocument();
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
    expect(screen.getByText(/Airport/)).toBeInTheDocument();
  });

  it('renders an ETA row per arrival', () => {
    renderView({
      groups: [
        group({
          arrivals: [
            dto({ trainId: 'A', arrivalTime: NOW_SEC + 240 }),
            dto({ trainId: 'B', arrivalTime: NOW_SEC + 60 }),
          ],
        }),
      ],
    });
    expect(screen.getByText('4 min')).toBeInTheDocument();
    expect(screen.getByText('1 min')).toBeInTheDocument();
  });

  it('shows a loading status region while loading', () => {
    renderView({ status: 'loading', groups: [] });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error message on error', () => {
    renderView({ status: 'error', groups: [], error: new Error('boom') });
    expect(screen.getByText(/Couldn.t load/i)).toBeInTheDocument();
  });

  it('shows an empty message when there are no upcoming trains', () => {
    renderView({ status: 'success', groups: [] });
    expect(screen.getByText(/No upcoming trains/i)).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is pressed', () => {
    const onRefresh = vi.fn();
    renderView({ onRefresh });
    screen.getByRole('button', { name: /refresh/i }).click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
