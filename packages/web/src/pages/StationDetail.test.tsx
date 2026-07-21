import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { StationDetail } from './StationDetail';
import { SettingsProvider } from '../features/settings/SettingsContext';

// One arrival in the proxy wire shape; fetchRailArrivals normalizes it.
const FIVE_POINTS_RED = {
  STATION: 'FIVE POINTS STATION',
  LINE: 'RED',
  DIRECTION: 'N',
  DESTINATION: 'North Springs',
  TRAIN_ID: '402',
  NEXT_ARR: '06:51:15 PM',
  WAITING_TIME: '4 min',
  WAITING_SECONDS: '240',
  IS_REALTIME: 'true',
  EVENT_TIME: '07/13/2026 6:47:15 PM',
  DELAY: 'T45S',
  LATITUDE: '33.75',
  LONGITUDE: '-84.39',
};

function stubFetchJson(data: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

function renderAt(path: string) {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/station/:stationName" element={<StationDetail />} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StationDetail', () => {
  it('title-cases the station name from the URL and renders its line sections', async () => {
    stubFetchJson([FIVE_POINTS_RED]);
    renderAt('/station/FIVE%20POINTS%20STATION');

    // Heading renders immediately from the URL param, title-cased.
    expect(screen.getByRole('heading', { name: 'Five Points Station' })).toBeInTheDocument();

    // After the fetch resolves, the arrival is grouped into a line section.
    await flushPromises();
    expect(screen.getByText(/Red/)).toBeInTheDocument();
    expect(screen.getByText(/North Springs/)).toBeInTheDocument();
  });
});
