import { useEffect, useState } from 'react';

/**
 * A ticking "current Unix seconds" value that updates every `intervalMs`.
 * Use this when display logic depends on elapsed time (relative
 * "X seconds ago", live ETA countdown) and you want the UI to re-render
 * at a steady cadence without coupling to the data fetch lifecycle.
 *
 * The ticker keeps running when the tab is hidden — browsers throttle
 * hidden setInterval callbacks anyway, and when the user returns the
 * next tick will catch up the displayed value.
 */
export function useNowSec(intervalMs: number): number {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return nowSec;
}
