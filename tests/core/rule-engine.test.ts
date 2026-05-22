import { describe, it, expect, vi } from 'vitest';
import { runRules } from '../../src/core/rule-engine';
import type { GlobalConfig, GroupFileRule, ScannedFile } from '../../src/types';

const now = 1_700_000_000_000;

const file: ScannedFile = {
  fileId: 'f1',
  fileName: 'clip.mp4',
  sizeBytes: 1000,
  updatedAt: now - 86_400_000,
  parentFolderId: '/',
  kind: 'video',
};

function baseRule(overrides: Partial<GroupFileRule> = {}): GroupFileRule {
  return {
    id: 'r1',
    enabled: true,
    triggers: [{ type: 'manual' }],
    match: { all: [] },
    action: { type: 'delete' },
    ...overrides,
  };
}

const global: GlobalConfig = { enabled: true };

describe('runRules', () => {
  it('dry-run: counts match without calling execute', async () => {
    const execute = vi.fn();
    const rules = [baseRule({ id: 'dry', dryRun: true })];

    const stats = await runRules({
      ctx: 'manual',
      global,
      groupId: '12345',
      rules,
      files: [file],
      now,
      execute,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(stats).toMatchObject({
      scanned: 1,
      matched: 1,
      deleted: 1,
      moved: 0,
      skipped: 0,
      errors: 0,
    });
  });

  it('stopProcessingOnMatch default stops second rule on same file', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce('deleted')
      .mockResolvedValueOnce('deleted');
    const rules = [
      baseRule({ id: 'first', priority: 0 }),
      baseRule({ id: 'second', priority: 1 }),
    ];

    const stats = await runRules({
      ctx: 'manual',
      global,
      groupId: '12345',
      rules,
      files: [file],
      now,
      execute,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(rules[0], file);
    expect(stats).toMatchObject({
      scanned: 1,
      matched: 1,
      deleted: 1,
    });
  });

  it('TTL: file too young → no execute', async () => {
    const execute = vi.fn();
    const youngFile: ScannedFile = {
      ...file,
      updatedAt: now - 3_600_000,
    };
    const rules = [
      baseRule({
        ttl: { value: 1, unit: 'days' },
      }),
    ];

    const stats = await runRules({
      ctx: 'manual',
      global,
      groupId: '12345',
      rules,
      files: [youngFile],
      now,
      execute,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(stats).toMatchObject({
      scanned: 1,
      matched: 0,
      deleted: 0,
      moved: 0,
      skipped: 0,
      errors: 0,
    });
  });
});
