import { describe, it, expect } from 'vitest';

import { createGeolocationApi } from './geolocation';

interface FakePosition {
  coords: { latitude: number; longitude: number; accuracy: number };
}

interface FakeError {
  code: number;
  message: string;
}

function makeFakeGeolocation(
  invoke: (
    success: (pos: FakePosition) => void,
    err: (e: FakeError) => void,
  ) => void,
): Geolocation {
  // The browser interface has watch/clear methods we don't use; cast
  // to satisfy the type while keeping the fake minimal.
  const getCurrentPosition: Geolocation['getCurrentPosition'] = (success, errorFn) => {
    invoke(
      success as unknown as (pos: FakePosition) => void,
      (errorFn as unknown as ((e: FakeError) => void) | null | undefined) ?? (() => {}),
    );
  };
  return { getCurrentPosition } as unknown as Geolocation;
}

describe('createGeolocationApi', () => {
  it('returns success with parsed coordinates', async () => {
    const api = createGeolocationApi(
      makeFakeGeolocation((success) =>
        success({ coords: { latitude: 33.754, longitude: -84.391, accuracy: 12 } }),
      ),
    );
    const result = await api.getCurrentPosition();
    expect(result).toEqual({
      status: 'success',
      coords: { lat: 33.754, lng: -84.391, accuracyMeters: 12 },
    });
  });

  it('returns denied on PERMISSION_DENIED (code 1)', async () => {
    const api = createGeolocationApi(
      makeFakeGeolocation((_, err) => err({ code: 1, message: 'User denied geolocation' })),
    );
    const result = await api.getCurrentPosition();
    expect(result).toEqual({ status: 'denied' });
  });

  it('returns unavailable on POSITION_UNAVAILABLE (code 2)', async () => {
    const api = createGeolocationApi(
      makeFakeGeolocation((_, err) => err({ code: 2, message: 'Position unavailable' })),
    );
    const result = await api.getCurrentPosition();
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('returns timeout on TIMEOUT (code 3)', async () => {
    const api = createGeolocationApi(
      makeFakeGeolocation((_, err) => err({ code: 3, message: 'Timed out' })),
    );
    const result = await api.getCurrentPosition();
    expect(result).toEqual({ status: 'timeout' });
  });

  it('returns error for an unrecognized error code', async () => {
    const api = createGeolocationApi(
      makeFakeGeolocation((_, err) => err({ code: 99, message: 'Mystery error' })),
    );
    const result = await api.getCurrentPosition();
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Mystery error');
    }
  });

  it('returns unavailable when the geolocation argument is undefined', async () => {
    const api = createGeolocationApi(undefined);
    const result = await api.getCurrentPosition();
    expect(result).toEqual({ status: 'unavailable' });
  });
});
