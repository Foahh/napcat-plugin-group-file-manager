export function isTtlEligible(fileUpdatedAt: number, ttlMs: number | undefined, now: number): boolean {
  if (ttlMs === undefined) return true;
  return fileUpdatedAt + ttlMs <= now;
}

export function sortRules<T extends { id: string; priority?: number }>(rules: T[]): T[] {
  return [...rules].sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
}

export function stopOnMatch(rule: { stopProcessingOnMatch?: boolean }): boolean {
  return rule.stopProcessingOnMatch !== false;
}
