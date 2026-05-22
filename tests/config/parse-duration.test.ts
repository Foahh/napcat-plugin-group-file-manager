import { describe, it, expect } from 'vitest';
import { parseDuration, durationToMs } from '../../src/config/parse-duration';
import type { Duration } from '../../src/types';

describe('parseDuration', () => {
  it('converts days to ms', () => {
    expect(durationToMs({ value: 1, unit: 'days' })).toBe(86400000);
  });
  it('converts hours', () => {
    expect(durationToMs({ value: 2, unit: 'hours' })).toBe(7200000);
  });
  it('rejects non-positive', () => {
    expect(() => durationToMs({ value: 0, unit: 'minutes' })).toThrow();
  });
});
