import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Atlanta Transit</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Real-time MARTA bus arrivals. Unofficial.
        </p>
      </header>

      <section className="rounded border border-divider bg-surface-elevated p-4">
        <h2 className="text-lg font-semibold">Early development</h2>
        <p className="mt-2 text-sm">
          The app shell is up. Stop detail pages will start showing real data in the
          next iteration. For now, you can navigate to a stop page by URL:
        </p>
        <p className="mt-3 font-mono text-sm">
          <Link to="/stop/134013" className="text-primary underline">
            /stop/134013
          </Link>
        </p>
      </section>
    </div>
  );
}
