import { describe, it, expect } from 'vitest';

import { railStationsFromArrivals } from './railStations';
import type { RailArrivalDTO } from '../../services/martaRail';

function arrival(overrides: Partial<RailArrivalDTO> = {}): RailArrivalDTO {
  return {
    station: 'FIVE POINTS STATION',
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    trainId: 'T',
    arrivalTime: 0,
    isRealtime: true,
    ...overrides,
  };
}

describe('railStationsFromArrivals', () => {
  it('returns an empty array for no arrivals', () => {
    expect(railStationsFromArrivals([])).toEqual([]);
  });

  it('produces one entry per distinct station, keyed on the feed name', () => {
    const stations = railStationsFromArrivals([
      arrival({ station: 'FIVE POINTS STATION' }),
      arrival({ station: 'FIVE POINTS STATION' }),
      arrival({ station: 'AIRPORT STATION' }),
    ]);
    expect(stations.map((s) => s.name)).toEqual(['AIRPORT STATION', 'FIVE POINTS STATION']);
  });

  it('title-cases a display name while keeping the raw feed name for linking', () => {
    const [station] = railStationsFromArrivals([arrival({ station: 'FIVE POINTS STATION' })]);
    expect(station?.name).toBe('FIVE POINTS STATION');
    expect(station?.displayName).toBe('Five Points Station');
  });

  it('collects the distinct lines serving a station, deduped', () => {
    const [station] = railStationsFromArrivals([
      arrival({ station: 'FIVE POINTS STATION', line: 'RED' }),
      arrival({ station: 'FIVE POINTS STATION', line: 'RED' }),
      arrival({ station: 'FIVE POINTS STATION', line: 'GOLD' }),
    ]);
    expect(station?.lines).toEqual(['RED', 'GOLD']);
  });

  it('orders lines canonically (Red, Gold, Blue, Green) regardless of arrival order', () => {
    const [station] = railStationsFromArrivals([
      arrival({ station: 'FIVE POINTS STATION', line: 'GREEN' }),
      arrival({ station: 'FIVE POINTS STATION', line: 'RED' }),
      arrival({ station: 'FIVE POINTS STATION', line: 'BLUE' }),
      arrival({ station: 'FIVE POINTS STATION', line: 'GOLD' }),
    ]);
    expect(station?.lines).toEqual(['RED', 'GOLD', 'BLUE', 'GREEN']);
  });

  it('sorts stations alphabetically by display name', () => {
    const stations = railStationsFromArrivals([
      arrival({ station: 'WEST END STATION' }),
      arrival({ station: 'AIRPORT STATION' }),
      arrival({ station: 'MIDTOWN STATION' }),
    ]);
    expect(stations.map((s) => s.displayName)).toEqual([
      'Airport Station',
      'Midtown Station',
      'West End Station',
    ]);
  });
});
