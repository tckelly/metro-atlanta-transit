import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const container = cva('flex items-baseline gap-3', {
  variants: {
    variant: {
      // Idiom A — prominent standalone card for short home-screen lists (Nearby).
      card: 'rounded border border-divider bg-surface-elevated p-3 transition-colors',
      // Idiom B — flush row for a `divide-y` list container (Search, Routes, RouteDetail).
      row: 'px-4 py-3 transition-colors',
    },
    interactive: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    { variant: 'card', interactive: true, class: 'group-hover:border-primary' },
    { variant: 'row', interactive: true, class: 'group-hover:bg-surface' },
  ],
  defaultVariants: { variant: 'row', interactive: false },
});

export interface ListItemProps extends VariantProps<typeof container> {
  /** Primary line — the stop name, route short name, etc. */
  title: ReactNode;
  /** Optional second line — direction label, route long name, arrival preview. Omitted when absent. */
  secondary?: ReactNode;
  /** Optional right-aligned slot — walk-time text, a chevron, reorder buttons. */
  trailing?: ReactNode;
  /** Optional left slot — a route badge/number. */
  leading?: ReactNode;
}

/**
 * The shared row shell behind the stop/route surfaces (ADR-0009). Presentational
 * and router-agnostic: it renders layout and, when `interactive`, a hover
 * affordance keyed off a parent marked `group`. The web package supplies the
 * navigation wrapper (`<Link>`) and the `<li>`, and maps domain data to these
 * visual-semantic slots at its boundary (ADR-0003).
 *
 * `variant` selects between two documented container idioms (see
 * `ux-guidelines.md`): `card` — a prominent, standalone, tappable stop card
 * for the short high-value home-screen lists (Nearby); `row` — a flush row for
 * a dense `divide-y` enumeration (Search, route stop lists). This is a real
 * visual-semantic distinction, not transitional scaffolding.
 */
export function ListItem({ title, secondary, trailing, leading, variant, interactive }: ListItemProps) {
  return (
    <div className={container({ variant, interactive })}>
      {leading !== undefined && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {secondary !== undefined && (
          <div className="mt-0.5 text-sm text-fg-muted">{secondary}</div>
        )}
      </div>
      {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
