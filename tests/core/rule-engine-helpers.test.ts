import { describe, it, expect } from 'vitest';
import { isTtlEligible, sortRules, stopOnMatch } from '../../src/core/rule-engine-helpers';

describe('isTtlEligible', () => {
  const now = 1_000_000;

  it('returns true when ttlMs is undefined', () => {
    expect(isTtlEligible(now - 1, undefined, now)).toBe(true);
  });

  it('returns false when file is younger than ttl', () => {
    const fileUpdatedAt = now - 5000;
    const ttlMs = 10_000;
    expect(isTtlEligible(fileUpdatedAt, ttlMs, now)).toBe(false);
  });

  it('returns true when file age equals ttl boundary', () => {
    const ttlMs = 10_000;
    const fileUpdatedAt = now - ttlMs;
    expect(isTtlEligible(fileUpdatedAt, ttlMs, now)).toBe(true);
  });

  it('returns true when file is older than ttl', () => {
    const fileUpdatedAt = now - 10_001;
    const ttlMs = 10_000;
    expect(isTtlEligible(fileUpdatedAt, ttlMs, now)).toBe(true);
  });
});

describe('sortRules', () => {
  it('sorts by ascending priority', () => {
    const rules = [
      { id: 'b', priority: 2 },
      { id: 'a', priority: 1 },
      { id: 'c', priority: 3 },
    ];
    expect(sortRules(rules).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats missing priority as 0', () => {
    const rules = [
      { id: 'high', priority: 1 },
      { id: 'default' },
      { id: 'low', priority: -1 },
    ];
    expect(sortRules(rules).map((r) => r.id)).toEqual(['low', 'default', 'high']);
  });

  it('breaks ties by id localeCompare', () => {
    const rules = [
      { id: 'rule-z', priority: 0 },
      { id: 'rule-a', priority: 0 },
      { id: 'rule-m', priority: 0 },
    ];
    expect(sortRules(rules).map((r) => r.id)).toEqual(['rule-a', 'rule-m', 'rule-z']);
  });

  it('does not mutate the input array', () => {
    const rules = [
      { id: 'b', priority: 2 },
      { id: 'a', priority: 1 },
    ];
    const copy = [...rules];
    sortRules(rules);
    expect(rules).toEqual(copy);
  });
});

describe('stopOnMatch', () => {
  it('defaults to true when stopProcessingOnMatch is omitted', () => {
    expect(stopOnMatch({})).toBe(true);
  });

  it('returns true when stopProcessingOnMatch is true', () => {
    expect(stopOnMatch({ stopProcessingOnMatch: true })).toBe(true);
  });

  it('returns false only when stopProcessingOnMatch is false', () => {
    expect(stopOnMatch({ stopProcessingOnMatch: false })).toBe(false);
  });
});
