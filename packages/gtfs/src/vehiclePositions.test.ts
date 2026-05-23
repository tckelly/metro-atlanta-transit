import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { decodeVehiclePositions } from './vehiclePositions';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../sample-data/marta-gtfs-rt-2026-05-22/vp.pb');
const vpBytes = new Uint8Array(readFileSync(fixturePath));

describe('decodeVehiclePositions against the 2026-05-22 snapshot', () => {
  it('parses the feed header timestamp', () => {
    const feed = decodeVehiclePositions(vpBytes);
    expect(feed.feedTimestamp).toBe(1779468884);
  });

  it('contains 198 vehicles', () => {
    const feed = decodeVehiclePositions(vpBytes);
    expect(feed.vehicles.length).toBe(198);
  });

  it('decodes a known vehicle with full position and occupancy', () => {
    const feed = decodeVehiclePositions(vpBytes);
    const vehicle = feed.vehicles.find((v) => v.vehicleId === '2303');
    expect(vehicle).toBeDefined();
    if (!vehicle) return;

    expect(vehicle.vehicleLabel).toBe('1603');
    expect(vehicle.tripId).toBe('10802068');
    expect(vehicle.routeId).toBe('116');
    expect(vehicle.startDate).toBe('20260522');
    expect(vehicle.latitude).toBeCloseTo(33.7036, 3);
    expect(vehicle.longitude).toBeCloseTo(-84.1155, 3);
    expect(vehicle.bearing).toBe(225);
    expect(vehicle.speed).toBeCloseTo(0.447, 2);
    expect(vehicle.timestamp).toBe(1779468505);
    expect(vehicle.occupancyStatus).toBe('MANY_SEATS_AVAILABLE');
  });

  it('exposes occupancy on roughly half of vehicles (matching recon stats)', () => {
    const feed = decodeVehiclePositions(vpBytes);
    const withOccupancy = feed.vehicles.filter((v) => v.occupancyStatus !== undefined).length;
    // Recon: 109/198 = 55%
    expect(withOccupancy).toBe(109);
  });

  it('throws on invalid input', () => {
    expect(() => decodeVehiclePositions(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
  });
});
