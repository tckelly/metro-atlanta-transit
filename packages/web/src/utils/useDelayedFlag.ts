/**
 * Returns `false` immediately, then flips to `true` after `delayMs`.
 * Used to delay the appearance of loading indicators so transitions
 * that complete quickly stay flicker-free.
 *
 * Cleans up the timer on unmount so a fast unmount/remount doesn't
 * leak setStates onto a stale component.
 */
import { useEffect, useState } from 'react';

export function useDelayedFlag(delayMs: number): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setFlag(true);
    }, delayMs);
    return () => {
      clearTimeout(id);
    };
  }, [delayMs]);
  return flag;
}
