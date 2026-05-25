/**
 * Home-screen section that finds the 5 stops nearest to the user.
 *
 * The browser geolocation prompt fires only after an explicit tap —
 * never on mount. The button copy plus inline rationale are the
 * "permission explainer" the M4 spec asks for; no separate screen
 * needed when the trigger and its explanation sit side by side.
 *
 * Stop ranking goes through the GtfsRepository — InMemory today,
 * potentially backend in the future without touching this component.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, MessageCard } from '@atl-transit/components';

import type { NearbyStop } from './getNearbyStops';
import {
  createGeolocationApi,
  type GeolocationApi,
  type GeolocationResult,
} from '../../services/geolocation';
import { useGtfsRepository } from '../../services/gtfs/GtfsRepositoryContext';
import type { GtfsRepository } from '../../services/gtfs/GtfsRepository';
import { formatWalkingMinutes } from '../../utils/walkingMinutes';

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
  /** Override the geolocation source. Defaults to `navigator.geolocation`. */
  geolocation?: GeolocationApi;
}

function defaultGeolocation(): GeolocationApi {
  return createGeolocationApi(
    typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
  );
}

async function applyResult(
  result: GeolocationResult,
  repo: GtfsRepository,
): Promise<State> {
  switch (result.status) {
    case 'success': {
      const stops = await repo.findNearbyStops(result.coords, NEARBY_COUNT);
      return { kind: 'success', stops };
    }
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

export function NearbyStops({ geolocation }: NearbyStopsProps = {}) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const api = geolocation ?? defaultGeolocation();

  const find = useCallback(async () => {
    setState({ kind: 'loading' });
    const result = await api.getCurrentPosition();
    const next = await applyResult(result, repo);
    setState(next);
  }, [api, repo]);

  return (
    <section aria-labelledby="nearby-heading" className="space-y-3">
      <h2 id="nearby-heading" className="text-lg font-semibold">
        {t('nearby.title')}
      </h2>

      {state.kind === 'idle' && <IdleView onFind={() => { void find(); }} />}
      {state.kind === 'loading' && (
        <p role="status" className="text-sm text-fg-muted">
          {t('nearby.finding')}
        </p>
      )}
      {state.kind === 'success' && <StopList stops={state.stops} />}
      {state.kind === 'denied' && <FailureView message={t('nearby.denied')} />}
      {state.kind === 'unavailable' && <FailureView message={t('nearby.unavailable')} />}
      {state.kind === 'timeout' && (
        <FailureView message={t('nearby.timeout')} onRetry={() => { void find(); }} />
      )}
      {state.kind === 'error' && (
        <FailureView message={t('nearby.error')} onRetry={() => { void find(); }} />
      )}
    </section>
  );
}

function IdleView({ onFind }: { onFind: () => void }) {
  const { t } = useTranslation();
  return (
    <MessageCard
      body={<p>{t('nearby.rationale')}</p>}
      action={
        <Button variant="primary" onClick={onFind}>
          {t('nearby.findButton')}
        </Button>
      }
    />
  );
}

function StopList({ stops }: { stops: NearbyStop[] }) {
  const { t } = useTranslation();
  if (stops.length === 0) {
    return <p className="text-sm text-fg-muted">{t('nearby.noResults')}</p>;
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
              {formatWalkingMinutes(stop.distanceMeters, t)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FailureView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <MessageCard
      body={message}
      action={
        onRetry !== undefined ? (
          <Button variant="neutral" onClick={onRetry}>
            {t('nearby.tryAgain')}
          </Button>
        ) : undefined
      }
    />
  );
}
