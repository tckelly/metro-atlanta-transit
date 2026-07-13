import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { NearbyStops } from './NearbyStops';
import type { GtfsBundle, StopOut } from '../../buildtime/preprocessGtfs';
import type { GeolocationApi, GeolocationResult } from '../../services/geolocation';
import { GtfsRepositoryProvider } from '../../services/gtfs/GtfsRepositoryContext';
import { InMemoryGtfsRepository } from '../../services/gtfs/InMemoryGtfsRepository';

const FIVE_POINTS = { lat: 33.754, lng: -84.391 };

const STOPS: StopOut[] = [
  { stopId: '1', name: 'Marietta @ Forsyth',     lat: 33.7544, lng: -84.3915, routeIds: ['51'], directions: [] },
  { stopId: '2', name: 'Peachtree Center',       lat: 33.7540, lng: -84.3893, routeIds: ['110'], directions: [] },
  { stopId: '3', name: 'Five Points Station',    lat: 33.7495, lng: -84.3915, routeIds: ['1'], directions: [] },
  { stopId: '4', name: 'CNN Center',             lat: 33.7540, lng: -84.4023, routeIds: ['12'], directions: [] },
  { stopId: '5', name: 'Civic Center',           lat: 33.7990, lng: -84.3915, routeIds: ['16'], directions: [] },
  { stopId: '6', name: 'Far away',               lat: 34.5000, lng: -84.0000, routeIds: ['99'], directions: [] },
];

const BUNDLE: GtfsBundle = {
  stops: STOPS,
  routes: [],
  trips: [],
  stopTimes: [],
  calendar: { rules: [], exceptions: [] },
};

// A single stop carrying one direction, plus the route so routeId → shortName
// resolves. Used to exercise the disambiguator secondary line.
const DIRECTIONS_BUNDLE: GtfsBundle = {
  stops: [
    {
      stopId: '1',
      name: 'Virginia Ave @ Maryland Ave',
      lat: 33.7544,
      lng: -84.3915,
      routeIds: ['R11'],
      directions: [{ routeId: 'R11', headsign: 'Collier Rd' }],
    },
  ],
  routes: [{ routeId: 'R11', shortName: '11', longName: 'Virginia Highland' }],
  trips: [],
  stopTimes: [],
  calendar: { rules: [], exceptions: [] },
};

function fakeGeolocation(result: GeolocationResult): GeolocationApi {
  return { getCurrentPosition: async () => result };
}

function renderWithRouter(ui: React.ReactNode, bundle: GtfsBundle = BUNDLE) {
  const repository = new InMemoryGtfsRepository(bundle);
  return render(
    <MemoryRouter>
      <GtfsRepositoryProvider repository={repository}>{ui}</GtfsRepositoryProvider>
    </MemoryRouter>,
  );
}

describe('NearbyStops — idle state', () => {
  it('renders an explainer and a "Find stops" button before permission is granted', () => {
    renderWithRouter(
      <NearbyStops

        geolocation={fakeGeolocation({ status: 'success', coords: { ...FIVE_POINTS, accuracyMeters: 10 } })}
      />,
    );
    expect(screen.getByRole('heading', { name: /nearby stops/i })).toBeInTheDocument();
    expect(screen.getByText(/we use your location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find stops near me/i })).toBeInTheDocument();
  });
});

describe('NearbyStops — direction disambiguator', () => {
  it('renders a route → headsign line with an accessible spoken label', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NearbyStops
        geolocation={fakeGeolocation({
          status: 'success',
          coords: { ...FIVE_POINTS, accuracyMeters: 10 },
        })}
      />,
      DIRECTIONS_BUNDLE,
    );

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));

    // Sighted users see the glyph form…
    expect(await screen.findByText('11 → Collier Rd')).toBeInTheDocument();
    // …but the "→" reads inconsistently, so the link exposes a spoken form.
    expect(
      screen.getByRole('link', {
        name: /Virginia Ave @ Maryland Ave.*Route 11 toward Collier Rd/,
      }),
    ).toBeInTheDocument();
  });
});

describe('NearbyStops — success', () => {
  it('lists the 5 nearest stops after a successful position fix', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NearbyStops

        geolocation={fakeGeolocation({ status: 'success', coords: { ...FIVE_POINTS, accuracyMeters: 10 } })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));

    // Five Points itself isn't in STOPS but the in-city stops should win
    // over "Far away". Expect exactly 5 stop names rendered.
    expect(await screen.findByText('Marietta @ Forsyth')).toBeInTheDocument();
    expect(screen.getByText('Peachtree Center')).toBeInTheDocument();
    expect(screen.getByText('Five Points Station')).toBeInTheDocument();
    expect(screen.getByText('CNN Center')).toBeInTheDocument();
    expect(screen.getByText('Civic Center')).toBeInTheDocument();
    expect(screen.queryByText('Far away')).toBeNull();
  });

  it('renders walking-time text next to each stop', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NearbyStops

        geolocation={fakeGeolocation({ status: 'success', coords: { ...FIVE_POINTS, accuracyMeters: 10 } })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));
    await screen.findByText('Marietta @ Forsyth');

    // At least the closest stop is well under one minute — so we expect
    // a "<1 min walk" label to show up at least once.
    expect(screen.getAllByText(/min walk/i).length).toBeGreaterThan(0);
  });

  it('renders each result as a link to /stop/:stopId', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NearbyStops

        geolocation={fakeGeolocation({ status: 'success', coords: { ...FIVE_POINTS, accuracyMeters: 10 } })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));
    const link = await screen.findByRole('link', { name: /marietta @ forsyth/i });
    expect(link).toHaveAttribute('href', '/stop/1');
  });
});

describe('NearbyStops — failure modes', () => {
  it('shows a denial message when the user blocks location', async () => {
    const user = userEvent.setup();
    renderWithRouter(<NearbyStops geolocation={fakeGeolocation({ status: 'denied' })} />);

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));
    expect(await screen.findByText(/location access (denied|blocked)/i)).toBeInTheDocument();
  });

  it('shows an "unavailable" message when the browser has no geolocation', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NearbyStops geolocation={fakeGeolocation({ status: 'unavailable' })} />,
    );

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));
    expect(await screen.findByText(/can.t find your location/i)).toBeInTheDocument();
  });

  it('shows a timeout message and a retry button on timeout', async () => {
    const user = userEvent.setup();
    renderWithRouter(<NearbyStops geolocation={fakeGeolocation({ status: 'timeout' })} />);

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));
    expect(await screen.findByText(/took too long|timed out/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows an error message and a retry button on unknown errors', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NearbyStops

        geolocation={fakeGeolocation({ status: 'error', error: new Error('boom') })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /find stops near me/i }));
    expect(await screen.findByText(/couldn.t get your location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
