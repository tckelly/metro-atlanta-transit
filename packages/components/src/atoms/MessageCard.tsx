/**
 * Surface card for short messages — loading hints, empty states, error
 * blurbs, and rationale text near a CTA.
 *
 * Centralizes the wrapper (border + surface-elevated + padding) so a
 * brand refresh is one edit. Internal typography defaults work for the
 * common "title + muted body" shape; callers pass rich React nodes when
 * they need different prose styling, and the action slot is an opaque
 * children slot so domain Buttons can drop in without coupling.
 */
import type { ReactNode } from 'react';

export interface MessageCardProps {
  /** Optional bold lead-in line above the body. */
  title?: ReactNode;
  /** Element to render the title as. Defaults to `h2`. Use `p` when the surrounding section already has its own heading. */
  titleAs?: 'h2' | 'h3' | 'p';
  /** Body content — string or rich React node. */
  body: ReactNode;
  /** Optional action slot below the body, typically a `Button`. */
  action?: ReactNode;
}

export function MessageCard({ title, titleAs = 'h2', body, action }: MessageCardProps) {
  const TitleEl = titleAs;
  return (
    <div className="rounded border border-divider bg-surface-elevated p-4">
      {title !== undefined && <TitleEl className="font-semibold">{title}</TitleEl>}
      <div
        className={
          title !== undefined ? 'mt-1 text-sm text-fg-muted' : 'text-sm text-fg'
        }
      >
        {body}
      </div>
      {action !== undefined && <div className="mt-3">{action}</div>}
    </div>
  );
}
