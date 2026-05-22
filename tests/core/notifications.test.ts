import { describe, it, expect } from 'vitest';
import {
  formatSummary,
  resolveNotificationMessage,
} from '../../src/core/notifications';
import type { GlobalConfig, GroupFileRule, RunStats } from '../../src/types';

const stats: RunStats = {
  scanned: 10,
  matched: 3,
  moved: 2,
  deleted: 1,
  skipped: 0,
  errors: 1,
};

const baseRule = (overrides: Partial<GroupFileRule> = {}): GroupFileRule => ({
  id: 'rule-1',
  enabled: true,
  triggers: [{ type: 'manual' }],
  match: {},
  action: { type: 'delete' },
  ...overrides,
});

const baseGlobal = (overrides: Partial<GlobalConfig> = {}): GlobalConfig => ({
  ...overrides,
});

describe('formatSummary', () => {
  it('formats run stats into a single Chinese summary line', () => {
    expect(formatSummary(stats)).toBe(
      '[群文件清理] 扫描 10 匹配 3 移动 2 删除 1 跳过 0 错误 1',
    );
  });
});

describe('resolveNotificationMessage', () => {
  it('returns null when notification is disabled', () => {
    const rule = baseRule({ notification: { enabled: false } });
    const global = baseGlobal({
      defaults: { notification: { enabled: true, level: 'summary' } },
    });
    expect(resolveNotificationMessage(rule, global, stats)).toBeNull();
  });

  it('returns null when notification is not configured', () => {
    expect(resolveNotificationMessage(baseRule(), baseGlobal(), stats)).toBeNull();
  });

  it('returns null for silent level', () => {
    const rule = baseRule({ notification: { enabled: true, level: 'silent' } });
    expect(resolveNotificationMessage(rule, baseGlobal(), stats)).toBeNull();
  });

  it('returns summary line for summary level', () => {
    const rule = baseRule({ notification: { enabled: true, level: 'summary' } });
    expect(resolveNotificationMessage(rule, baseGlobal(), stats)).toBe(formatSummary(stats));
  });

  it('defaults to summary when enabled but level is omitted', () => {
    const rule = baseRule({ notification: { enabled: true } });
    expect(resolveNotificationMessage(rule, baseGlobal(), stats)).toBe(formatSummary(stats));
  });

  it('inherits enabled and level from global.defaults when rule omits notification', () => {
    const global = baseGlobal({
      defaults: { notification: { enabled: true, level: 'summary' } },
    });
    expect(resolveNotificationMessage(baseRule(), global, stats)).toBe(formatSummary(stats));
  });

  it('inherits level from global when rule only sets enabled', () => {
    const rule = baseRule({ notification: { enabled: true } });
    const global = baseGlobal({
      defaults: { notification: { enabled: false, level: 'verbose' } },
    });
    const details = ['moved: a.txt', 'deleted: b.txt'];
    const msg = resolveNotificationMessage(rule, global, stats, details);
    expect(msg).toBe([formatSummary(stats), ...details].join('\n'));
  });

  it('rule notification overrides global defaults', () => {
    const rule = baseRule({ notification: { enabled: true, level: 'silent' } });
    const global = baseGlobal({
      defaults: { notification: { enabled: true, level: 'summary' } },
    });
    expect(resolveNotificationMessage(rule, global, stats)).toBeNull();
  });

  it('verbose returns summary plus detail lines capped at 20', () => {
    const rule = baseRule({ notification: { enabled: true, level: 'verbose' } });
    const details = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`);
    const msg = resolveNotificationMessage(rule, baseGlobal(), stats, details)!;
    const lines = msg!.split('\n');
    expect(lines[0]).toBe(formatSummary(stats));
    expect(lines).toHaveLength(21);
    expect(lines[1]).toBe('line 1');
    expect(lines[20]).toBe('line 20');
  });

  it('verbose without details returns summary only', () => {
    const rule = baseRule({ notification: { enabled: true, level: 'verbose' } });
    expect(resolveNotificationMessage(rule, baseGlobal(), stats)).toBe(formatSummary(stats));
  });
});
