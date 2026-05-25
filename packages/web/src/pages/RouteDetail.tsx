/**
 * Route detail — header + one stop list per headsign direction.
 *
 * Each stop is a link to /stop/:stopId so the user can pivot from
 * route-discovery into "what's coming next at this stop" without typing
 * a stop ID.
 */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useGtfsBundle } from '../services/useGtfsBundle';
import { getRouteDirections } from '../features/routes/getRouteDirections';
import { getRouteMetadata } from '../services/gtfsStatic';

export function RouteDetail() {
  const { routeId } = useParams<{ routeId: string }>();
  const { bundle, loading, error } = useGtfsBundle();

  const directions = useMemo(() => {
    if (bundle === null || routeId === undefined) return [];
    return getRouteDirections(bundle, routeId);
  }, [bundle, routeId]);

  if (routeId === undefined) {
    return <Message title="No route ID" body="The URL is missing a route ID." />;
  }

  if (loading) return <Message title="Loading route…" body="One moment." />;
  if (error !== null || bundle === null) {
    return (
      <Message
        title="Couldn’t load route data"
        body={error?.message ?? 'Unknown error.'}
      />
    );
  }

  const route = getRouteMetadata(bundle, routeId);
  const shortName = route?.shortName ?? routeId;
  const longName = route?.longName ?? '';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/routes" aria-label="Back to all routes" className="text-2xl text-primary">
          ←
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Route {shortName}</h1>
          {longName !== '' && <p className="truncate text-sm text-fg-muted">{longName}</p>}
        </div>
      </header>

      {directions.length === 0 && (
        <Message
          title="No stops found"
          body="This route doesn’t have any stop information in the current schedule data."
        />
      )}

      {directions.map((direction) => (
        <section key={direction.headsign} aria-labelledby={`dir-${direction.headsign}`}>
          <h2 id={`dir-${direction.headsign}`} className="text-base font-semibold">
            Toward {direction.headsign}
          </h2>
          <ol className="mt-2 divide-y divide-divider rounded border border-divider bg-surface-elevated">
            {direction.stops.map((stop) => (
              <li key={stop.stopId}>
                <Link
                  to={`/stop/${stop.stopId}`}
                  className="block px-4 py-3 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {stop.name}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-divider bg-surface-elevated p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{body}</p>
    </div>
  );
}
