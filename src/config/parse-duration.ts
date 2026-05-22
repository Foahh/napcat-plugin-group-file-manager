import type { Duration, DurationUnit } from '../types';

const MULTIPLIERS: Record<DurationUnit, number> = {
  seconds: 1e3,
  minutes: 60e3,
  hours: 3600e3,
  days: 86400e3,
};

export function durationToMs(d: Duration): number {
  if (!Number.isFinite(d.value) || d.value <= 0) {
    throw new Error(`Invalid duration value: ${d.value}`);
  }
  const mult = MULTIPLIERS[d.unit];
  if (!mult) throw new Error(`Invalid duration unit: ${d.unit}`);
  return d.value * mult;
}

export function parseDuration(raw: unknown): Duration {
  if (typeof raw !== 'object' || raw === null) throw new Error('Duration must be object');
  const o = raw as Record<string, unknown>;
  const value = Number(o.value);
  const unit = o.unit as DurationUnit;
  if (!['seconds', 'minutes', 'hours', 'days'].includes(unit)) {
    throw new Error(`Invalid duration unit: ${unit}`);
  }
  const d = { value, unit };
  durationToMs(d);
  return d;
}
