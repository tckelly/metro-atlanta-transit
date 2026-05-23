/**
 * Minimal icon atom. Two icons inlined as SVG paths, no external library.
 * Color is inherited via `currentColor` so the parent sets the color through
 * a Tailwind `text-*` class (or any CSS `color`). Size is fixed at 20×20.
 *
 * Always rendered with `aria-hidden="true"` — icons are decorative and the
 * surrounding text carries the accessible meaning. If you ever need an icon
 * to *be* the accessible label, wrap it in an element with `aria-label`.
 */

export type IconName = 'clock' | 'warning';

export interface IconProps {
  name: IconName;
}

export function Icon({ name }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={name}
    >
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </>
      )}
      {name === 'warning' && (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
      )}
    </svg>
  );
}
