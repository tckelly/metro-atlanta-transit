import type { LineIndicatorProps } from '@atl-transit/components';
import type { TFunction } from 'i18next';

/** Domain `LINE` → visual line token (ADR-0003 boundary); unknown → neutral. */
const LINE_TOKENS: Record<string, LineIndicatorProps['line']> = {
  RED: 'red',
  GOLD: 'gold',
  BLUE: 'blue',
  GREEN: 'green',
};

/** Map a feed `LINE` value to the `LineIndicator` visual token. */
export function railLineToken(line: string): LineIndicatorProps['line'] {
  return LINE_TOKENS[line] ?? 'neutral';
}

/** Localized line name; falls back to the raw feed value for an unknown line. */
export function railLineLabel(line: string, t: TFunction): string {
  const key = `rail.line.${line.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? line : translated;
}
