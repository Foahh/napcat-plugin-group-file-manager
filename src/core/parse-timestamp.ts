export function toMs(ts: number): number {
  if (!Number.isFinite(ts) || ts <= 0) return Date.now();
  return ts >= 1e12 ? ts : ts * 1000;
}
