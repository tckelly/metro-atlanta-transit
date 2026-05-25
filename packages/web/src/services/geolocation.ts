/**
 * Typed wrapper around `navigator.geolocation`.
 *
 * The browser API is callback-based and signals failure modes as opaque
 * error codes; we translate those into a discriminated `GeolocationResult`
 * so callers handle each outcome explicitly. The implementation is
 * dependency-injected so tests can pass a fake `Geolocation` without
 * touching `navigator`.
 */

export interface Coordinates {
  lat: number;
  lng: number;
  /** Reported horizontal accuracy in meters (radius of 95% confidence). */
  accuracyMeters: number;
}

export type GeolocationResult =
  | { status: 'success'; coords: Coordinates }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'timeout' }
  | { status: 'error'; error: Error };

export interface GeolocationApi {
  /**
   * Request the device's current position once. Resolves with a
   * `GeolocationResult` — never rejects, so callers never need a
   * try/catch around it.
   */
  getCurrentPosition(): Promise<GeolocationResult>;
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  // 15s — bus-stop searches are time-sensitive but most phones get a
  // coarse fix in 2-5s. A loose ceiling beats a hard hang.
  timeout: 15_000,
  // 1 minute of cache — a stop list is forgiving; no need to spend
  // battery re-acquiring GPS if we just had a fix.
  maximumAge: 60_000,
};

export function createGeolocationApi(geolocation: Geolocation | undefined): GeolocationApi {
  return {
    getCurrentPosition: () =>
      new Promise<GeolocationResult>((resolve) => {
        if (geolocation === undefined) {
          resolve({ status: 'unavailable' });
          return;
        }
        geolocation.getCurrentPosition(
          (position) => {
            resolve({
              status: 'success',
              coords: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracyMeters: position.coords.accuracy,
              },
            });
          },
          (error) => {
            switch (error.code) {
              case 1: // PERMISSION_DENIED
                resolve({ status: 'denied' });
                return;
              case 2: // POSITION_UNAVAILABLE
                resolve({ status: 'unavailable' });
                return;
              case 3: // TIMEOUT
                resolve({ status: 'timeout' });
                return;
              default:
                resolve({
                  status: 'error',
                  error: new Error(`Geolocation failed (code ${error.code}): ${error.message}`),
                });
            }
          },
          DEFAULT_OPTIONS,
        );
      }),
  };
}
