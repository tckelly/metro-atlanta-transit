import type { DirectionsLabel } from '../../utils/directionsLabel';

export interface DirectionLabelProps {
  /** The `{ visible, label }` produced by `formatDirections`. */
  value: DirectionsLabel;
  /** Element to render — `span` inline (default), `p`, or `h2` (route-group header). */
  as?: 'span' | 'p' | 'h2';
  className?: string;
}

/**
 * Renders a stop's direction line so the visible "→" glyph text and its spoken
 * accessible name stay paired in one place. The `→` reads inconsistently across
 * screen readers, so the element's `aria-label` carries the spoken form
 * ("Route 11 toward Collier Rd"); centralizing this keeps every surface that
 * shows a direction from re-wiring — or forgetting — that a11y contract.
 */
export function DirectionLabel({ value, as: Tag = 'span', className }: DirectionLabelProps) {
  return (
    <Tag aria-label={value.label} className={className}>
      {value.visible}
    </Tag>
  );
}
