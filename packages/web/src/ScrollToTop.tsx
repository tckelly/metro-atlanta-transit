/**
 * Resets the document scroll to the top whenever the route's pathname
 * changes. Without this, SPA navigation carries the previous page's
 * scroll position into the new page — e.g., the user scrolls down on
 * Home to reach the Settings link, taps it, and lands part-way down
 * the Settings page. The web convention is that forward navigation
 * starts at the top, so we honor it.
 *
 * Why `useLayoutEffect`, not `useEffect`. `useEffect` runs *after* the
 * browser paints, so the new route paints for one frame at the old
 * scroll position and then snaps to the top — a visible flash, even
 * if brief. `useLayoutEffect` runs synchronously between commit and
 * paint, so the scroll happens before the browser ever shows the new
 * page. This is the canonical case the layout-effect hook exists for
 * (DOM-position adjustments that must not be visible mid-transition);
 * the React Router v6.4+ data-router `<ScrollRestoration />` does the
 * same thing internally. SSR isn't a concern — we're a Vite SPA.
 *
 * Forward-only by design (see `docs/launch-checklist.md` § "Scroll-to-top
 * on forward navigation"). Pages in this app are 1–2 screens; the cost
 * of also landing-at-top on browser back is one swipe to recover, and
 * a single predictable rule beats per-key scroll-position persistence.
 * Promote to the data router's `<ScrollRestoration />` only if dogfooding
 * shows the back case is actually annoying.
 *
 * Depends only on `pathname`, not the full `location` object — search-
 * string or hash-only changes (e.g. a `?lng=es` language toggle on the
 * current page) must not yank the user back to the top.
 */
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop(): null {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
