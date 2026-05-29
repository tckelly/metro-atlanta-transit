import { describe, it, expect } from 'vitest';

import { pickRouteChunk } from './preloadInitialRoute';

describe('pickRouteChunk', () => {
  const chunks = {
    home: () => Promise.resolve('home'),
    routes: () => Promise.resolve('routes'),
    routeDetail: () => Promise.resolve('routeDetail'),
    stopDetail: () => Promise.resolve('stopDetail'),
    settings: () => Promise.resolve('settings'),
  };

  it.each([
    ['/', 'home'],
    ['/routes', 'routes'],
    ['/routes/', 'routes'],
    ['/route/12', 'routeDetail'],
    ['/stop/9000', 'stopDetail'],
    ['/settings', 'settings'],
    ['/unknown', 'home'],
  ])('selects the right chunk for %s', async (pathname, expected) => {
    await expect(pickRouteChunk(pathname, chunks)()).resolves.toBe(expected);
  });
});
