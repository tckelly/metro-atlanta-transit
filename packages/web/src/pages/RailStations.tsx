import { RailStationsView } from '../features/rail/RailStationsView';
import { useRailStations } from '../features/rail/useRailStations';

/**
 * Route container for the rail station directory. Thin glue: drives
 * `useRailStations` and hands off to the presentational `RailStationsView`.
 * The entry point that makes `/station/:name` reachable in-app.
 */
export function RailStations() {
  const { status, stations, error, refresh } = useRailStations();
  return (
    <RailStationsView
      status={status}
      stations={stations}
      error={error}
      onRefresh={() => {
        void refresh();
      }}
    />
  );
}
