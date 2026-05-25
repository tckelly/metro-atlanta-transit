import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { FavoriteStarButton } from './FavoriteStarButton';
import {
  FavoritesProvider,
  useFavorites,
} from './FavoritesContext';
import { ToastProvider } from '../toast/ToastContext';
import {
  FAVORITES_STORAGE_KEY,
  MAX_FAVORITES,
  type Favorite,
  type FavoritesStorage,
} from '../../services/storage';

function makeMemoryStorage(seed: Record<string, string> = {}): FavoritesStorage {
  const map = new Map<string, string>(Object.entries(seed));
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

function Surface({
  storage,
  children,
}: {
  storage: FavoritesStorage;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <FavoritesProvider storage={storage}>{children}</FavoritesProvider>
    </ToastProvider>
  );
}

function FavoritesProbe() {
  const { favorites } = useFavorites();
  return <div data-testid="probe">{favorites.map((f) => f.stopId).join(',')}</div>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FavoriteStarButton', () => {
  it('exposes "Add … to favorites" when the stop is not favorited', () => {
    render(
      <Surface storage={makeMemoryStorage()}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave @ Todd Rd" />
      </Surface>,
    );
    expect(
      screen.getByRole('button', { name: /add virginia ave @ todd rd to favorites/i }),
    ).toBeInTheDocument();
  });

  it('exposes "Remove … from favorites" when the stop is favorited', () => {
    const seed: Favorite[] = [{ stopId: '902990', addedAt: 1 }];
    render(
      <Surface storage={makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(seed) })}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave @ Todd Rd" />
      </Surface>,
    );
    expect(
      screen.getByRole('button', { name: /remove virginia ave @ todd rd from favorites/i }),
    ).toBeInTheDocument();
  });

  it('add: click favorites the stop and shows an undo toast', async () => {
    const user = userEvent.setup();
    const storage = makeMemoryStorage();
    render(
      <Surface storage={storage}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave" />
        <FavoritesProbe />
      </Surface>,
    );

    await user.click(screen.getByRole('button', { name: /add virginia ave to favorites/i }));

    expect(screen.getByTestId('probe')).toHaveTextContent('902990');
    expect(screen.getByRole('status')).toHaveTextContent(/added virginia ave/i);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('remove: click unfavorites the stop and shows an undo toast', async () => {
    const user = userEvent.setup();
    const seed: Favorite[] = [{ stopId: '902990', addedAt: 1 }];
    const storage = makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(seed) });
    render(
      <Surface storage={storage}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave" />
        <FavoritesProbe />
      </Surface>,
    );

    await user.click(screen.getByRole('button', { name: /remove virginia ave from favorites/i }));

    expect(screen.getByTestId('probe')).toHaveTextContent('');
    expect(screen.getByRole('status')).toHaveTextContent(/removed virginia ave/i);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('undo after add removes the stop', async () => {
    const user = userEvent.setup();
    render(
      <Surface storage={makeMemoryStorage()}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave" />
        <FavoritesProbe />
      </Surface>,
    );

    await user.click(screen.getByRole('button', { name: /add virginia ave to favorites/i }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByTestId('probe')).toHaveTextContent('');
  });

  it('undo after remove re-adds the stop', async () => {
    const user = userEvent.setup();
    const seed: Favorite[] = [{ stopId: '902990', addedAt: 1 }];
    const storage = makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(seed) });
    render(
      <Surface storage={storage}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave" />
        <FavoritesProbe />
      </Surface>,
    );

    await user.click(screen.getByRole('button', { name: /remove virginia ave from favorites/i }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByTestId('probe')).toHaveTextContent('902990');
  });

  it('shows a "full" toast and does not add when at MAX_FAVORITES', async () => {
    const user = userEvent.setup();
    const full: Favorite[] = Array.from({ length: MAX_FAVORITES }, (_, i) => ({
      stopId: `existing-${i}`,
      addedAt: i,
    }));
    const storage = makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(full) });
    render(
      <Surface storage={storage}>
        <FavoriteStarButton stopId="new-stop" stopName="New Stop" />
        <FavoritesProbe />
      </Surface>,
    );

    await user.click(screen.getByRole('button', { name: /add new stop to favorites/i }));

    expect(screen.getByTestId('probe')).not.toHaveTextContent('new-stop');
    expect(screen.getByRole('status')).toHaveTextContent(/full/i);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('reflects aria-pressed=true when favorited', () => {
    const seed: Favorite[] = [{ stopId: '902990', addedAt: 1 }];
    render(
      <Surface storage={makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(seed) })}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave" />
      </Surface>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reflects aria-pressed=false when not favorited', () => {
    render(
      <Surface storage={makeMemoryStorage()}>
        <FavoriteStarButton stopId="902990" stopName="Virginia Ave" />
      </Surface>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
