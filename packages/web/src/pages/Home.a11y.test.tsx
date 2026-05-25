/**
 * Accessibility scan of the Home page.
 *
 * Runs axe against the rendered DOM in two representative states:
 *  - empty favorites (the cold-open case for a new user)
 *  - one favorite (the steady-state case once dogfood is happening)
 *
 * Catches ARIA / semantic / label regressions. Does NOT catch color
 * contrast (jsdom doesn't compute styles) — see test-setup.ts.
 */
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';

import { Home } from './Home';
import { renderForA11y } from '../test-utils/a11y';
import {
  FAVORITES_STORAGE_KEY,
  type Favorite,
} from '../services/storage';

function makeFavoritesStorage(seed: Favorite[]): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  const map = new Map<string, string>([[FAVORITES_STORAGE_KEY, JSON.stringify(seed)]]);
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('Home — a11y', () => {
  it('passes axe with empty favorites', async () => {
    const { container } = renderForA11y(<Home />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe with one favorite', async () => {
    const favoritesStorage = makeFavoritesStorage([
      { stopId: '902990', addedAt: 1700000000 },
    ]);
    const { container } = renderForA11y(<Home />, { favoritesStorage });
    expect(await axe(container)).toHaveNoViolations();
  });
});
