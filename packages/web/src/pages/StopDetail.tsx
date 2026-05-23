import { Link, useParams } from 'react-router-dom';

export function StopDetail() {
  const { stopId } = useParams<{ stopId: string }>();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label="Back to home" className="text-primary">
          ←
        </Link>
        <h1 className="text-2xl font-bold">Stop {stopId}</h1>
      </header>

      <section className="rounded border border-divider bg-surface-elevated p-4">
        <p className="text-sm text-fg-muted">
          Placeholder view. Live arrivals will wire up in the next cycle —
          useArrivals hook + busRowMapper + BusRow organism. The data layer
          underneath is already tested.
        </p>
      </section>
    </div>
  );
}
