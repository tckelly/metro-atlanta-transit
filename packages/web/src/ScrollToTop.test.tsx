/**
 * Tests for `ScrollToTop` — fires `window.scrollTo(0, 0)` whenever the
 * route's pathname changes, so the user lands at the top of the new
 * page on every forward navigation.
 *
 * The component is pure side-effect on `useLocation`, so the tests
 * render it under a `MemoryRouter` and trigger navigations through a
 * small button child rather than reaching into router internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { ScrollToTop } from './ScrollToTop';

function NavButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        navigate(to);
      }}
    >
      {label}
    </button>
  );
}

describe('ScrollToTop', () => {
  let scrollSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollSpy.mockRestore();
  });

  it('scrolls to the top when the pathname changes', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <NavButton to="/settings" label="go" />
      </MemoryRouter>,
    );

    // Initial mount may fire once; we only care that the navigation
    // produces a (0, 0) call.
    scrollSpy.mockClear();
    fireEvent.click(getByText('go'));

    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
  });

  it('does not scroll when only the search string changes', () => {
    // pathname stays `/settings`; the dep array on the effect must
    // ignore search/hash changes so an in-page query toggle doesn't
    // yank the user back to the top.
    const { getByText } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <ScrollToTop />
        <NavButton to="/settings?lng=es" label="go" />
      </MemoryRouter>,
    );

    scrollSpy.mockClear();
    fireEvent.click(getByText('go'));

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
