import type { GlobalConfig, GroupFileRule, NotificationConfig, RunStats } from '../types.js';

const MAX_VERBOSE_DETAIL_LINES = 20;

export function formatSummary(stats: RunStats): string {
  return `[群文件清理] 扫描 ${stats.scanned} 匹配 ${stats.matched} 移动 ${stats.moved} 删除 ${stats.deleted} 跳过 ${stats.skipped} 错误 ${stats.errors}`;
}

export function resolveNotificationConfig(
  rule: GroupFileRule,
  global: GlobalConfig,
): NotificationConfig {
  const ruleN = rule.notification;
  const globalN = global.defaults?.notification;
  return {
    enabled: ruleN?.enabled ?? globalN?.enabled,
    level: ruleN?.level ?? globalN?.level,
  };
}

export function resolveNotificationMessage(
  rule: GroupFileRule,
  global: GlobalConfig,
  stats: RunStats,
  details?: string[],
): string | null {
  const { enabled, level } = resolveNotificationConfig(rule, global);
  if (!enabled) return null;

  const effectiveLevel = level ?? 'summary';
  if (effectiveLevel === 'silent') return null;

  const summary = formatSummary(stats);
  if (effectiveLevel === 'summary') return summary;

  if (!details?.length) return summary;
  const capped = details.slice(0, MAX_VERBOSE_DETAIL_LINES);
  return [summary, ...capped].join('\n');
}
