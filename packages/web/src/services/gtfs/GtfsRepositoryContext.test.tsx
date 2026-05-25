import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import {
  GtfsRepositoryProvider,
  useGtfsRepository,
} from './GtfsRepositoryContext';
import { InMemoryGtfsRepository } from './InMemoryGtfsRepository';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

const EMPTY_BUNDLE: GtfsBundle = {
  stops: [],
  routes: [],
  trips: [],
  stopTimes: [],
  calendar: { rules: [], exceptions: [] },
};

describe('GtfsRepositoryProvider', () => {
  it('exposes the provided repository to consumers', () => {
    const repo = new InMemoryGtfsRepository(EMPTY_BUNDLE);
    const { result } = renderHook(() => useGtfsRepository(), {
      wrapper: ({ children }) => (
        <GtfsRepositoryProvider repository={repo}>{children}</GtfsRepositoryProvider>
      ),
    });
    expect(result.current).toBe(repo);
  });

  it('useGtfsRepository throws when called outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useGtfsRepository())).toThrow(
      /GtfsRepositoryProvider/,
    );
    spy.mockRestore();
  });
});
