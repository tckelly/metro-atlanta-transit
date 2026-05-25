import { describe, it, expect } from 'vitest';

import { formatWalkingMinutes, walkingMinutes } from './walkingMinutes';
import { i18next } from '../i18n/init';

const t = i18next.t.bind(i18next);

describe('walkingMinutes', () => {
  it('is 0 for 0 meters', () => {
    expect(walkingMinutes(0)).toBe(0);
  });

  it('uses ~80 m/min so 80 m is 1 minute', () => {
    expect(walkingMinutes(80)).toBe(1);
  });

  it('rounds up so 81 m is 2 minutes (conservative pace)', () => {
    expect(walkingMinutes(81)).toBe(2);
  });

  it('handles a typical 400 m / 5 min walk', () => {
    expect(walkingMinutes(400)).toBe(5);
  });

  it('rejects negative input by clamping to 0', () => {
    expect(walkingMinutes(-50)).toBe(0);
  });
});

describe('formatWalkingMinutes', () => {
  it('renders "<1 min walk" for distances under one minute', () => {
    expect(formatWalkingMinutes(20, t)).toBe('<1 min walk');
  });

  it('renders "1 min walk" at exactly 80 m', () => {
    expect(formatWalkingMinutes(80, t)).toBe('1 min walk');
  });

  it('renders "5 min walk" for a 400 m walk', () => {
    expect(formatWalkingMinutes(400, t)).toBe('5 min walk');
  });

  it('renders "<1 min walk" for 0 m (don\'t claim instant)', () => {
    expect(formatWalkingMinutes(0, t)).toBe('<1 min walk');
  });
});
