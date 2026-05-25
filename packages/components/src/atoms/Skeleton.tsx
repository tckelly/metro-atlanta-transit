/**
 * A loading-state placeholder block. Use multiple Skeletons in the
 * shape of the content that's about to appear — the user sees the
 * layout settle into place rather than a blank then a snap.
 *
 * Decorative by design: `aria-hidden` keeps the pulse out of screen-
 * reader output. Surrounding text (e.g., "Loading arrivals…") in a
 * live region carries the accessibility meaning.
 *
 * Size is the caller's job — pass Tailwind classes like `h-6 w-32`
 * via `className`. Keeps the atom dumb and lets each consumer match
 * the shape of its real content.
 */

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  const cls = ['animate-pulse rounded bg-surface-elevated', className]
    .filter(Boolean)
    .join(' ');
  return <div aria-hidden="true" className={cls} />;
}
