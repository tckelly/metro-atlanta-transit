import { Link } from 'react-router-dom';

interface PinnedStop {
  stopId: string;
  name: string;
  direction: string;
}

const PINNED_STOPS: PinnedStop[] = [
  { stopId: '902990', name: 'Virginia Ave @ Todd Rd',     direction: 'Westbound' },
  { stopId: '904428', name: 'Ponce de Leon @ Barnett St', direction: 'Westbound' },
];

export function Home() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Atlanta Transit</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Real-time MARTA bus arrivals. Unofficial.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">My stops</h2>
        <ul className="space-y-2">
          {PINNED_STOPS.map((stop) => (
            <li key={stop.stopId}>
              <Link
                to={`/stop/${stop.stopId}`}
                className="block rounded border border-divider bg-surface-elevated p-4 transition-colors hover:border-primary"
              >
                <div className="font-semibold">{stop.name}</div>
                <div className="text-sm text-fg-muted">{stop.direction}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
