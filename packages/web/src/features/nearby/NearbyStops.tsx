/**
 * Home-screen section that finds the 5 stops nearest to the user.
 *
 * The browser geolocation prompt fires only after an explicit tap — never
 * on mount. The button copy plus inline rationale are the "permission
 * explainer" the M4 spec asks for; no separate screen needed when the
 * trigger and its explanation sit side by side.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, MessageCard } from '@atl-transit/components';

import { getNearbyStops, type NearbyStop } from './getNearbyStops';
import {
  createGeolocationApi,
  type GeolocationApi,
  type GeolocationResult,
} from '../../services/geolocation';
import { formatWalkingMinutes } from '../../utils/walkingMinutes';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

const NEARBY_COUNT = 5;

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; stops: NearbyStop[] }
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string };

export interface NearbyStopsProps {
  bundle: GtfsBundle;
  /** Override the geolocation source. Defaults to `navigator.geolocation`. */
  geolocation?: GeolocationApi;
}

function defaultGeolocation(): GeolocationApi {
  return createGeolocationApi(
    typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
  );
}

function applyResult(result: GeolocationResult, bundle: GtfsBundle): State {
  switch (result.status) {
    case 'success':
      return {
        kind: 'success',
        stops: getNearbyStops(bundle, result.coords, NEARBY_COUNT),
      };
    case 'denied':
      return { kind: 'denied' };
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'timeout':
      return { kind: 'timeout' };
    case 'error':
      return { kind: 'error', message: result.error.message };
  }
}

export function NearbyStops({ bundle, geolocation }: NearbyStopsProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const api = geolocation ?? defaultGeolocation();

  const find = useCallback(async () => {
    setState({ kind: 'loading' });
    const result = await api.getCurrentPosition();
    setState(applyResult(result, bundle));
  }, [api, bundle]);

  return (
    <section aria-labelledby="nearby-heading" className="space-y-3">
      <h2 id="nearby-heading" className="text-lg font-semibold">
        Nearby stops
      </h2>

      {state.kind === 'idle' && <IdleView onFind={find} />}
      {state.kind === 'loading' && (
        <p role="status" className="text-sm text-fg-muted">
          Finding your location…
        </p>
      )}
      {state.kind === 'success' && <StopList stops={state.stops} />}
      {state.kind === 'denied' && (
        <FailureView
          message="Location access denied. Enable it in your browser settings to find stops near you."
        />
      )}
      {state.kind === 'unavailable' && (
        <FailureView message="We can’t find your location on this device." />
      )}
      {state.kind === 'timeout' && (
        <FailureView message="That took too long. Make sure location is on and try again." onRetry={find} />
      )}
      {state.kind === 'error' && (
        <FailureView message="Couldn’t get your location. Try again in a moment." onRetry={find} />
      )}
    </section>
  );
}

function IdleView({ onFind }: { onFind: () => void }) {
  return (
    <MessageCard
      body={
        <p>
          We use your location only on this device to find the nearest bus stops. Nothing
          leaves your phone.
        </p>
      }
      action={
        <Button variant="primary" onClick={onFind}>
          Find stops near me
        </Button>
      }
    />
  );
}

function StopList({ stops }: { stops: NearbyStop[] }) {
  if (stops.length === 0) {
    return <p className="text-sm text-fg-muted">No bus stops found near you.</p>;
  }
  return (
    <ul className="space-y-2">
      {stops.map((stop) => (
        <li key={stop.stopId}>
          <Link
            to={`/stop/${stop.stopId}`}
            className="flex items-baseline justify-between gap-3 rounded border border-divider bg-surface-elevated p-3 transition-colors hover:border-primary"
          >
            <span className="min-w-0 truncate font-medium">{stop.name}</span>
            <span className="whitespace-nowrap text-sm text-fg-muted">
              {formatWalkingMinutes(stop.distanceMeters)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FailureView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <MessageCard
      body={message}
      action={
        onRetry !== undefined ? (
          <Button variant="neutral" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}
