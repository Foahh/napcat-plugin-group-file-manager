import { durationToMs } from '../config/parse-duration';
import type { PluginLogger } from 'napcat-types/napcat-onebot/network/plugin/types';
import type {
  GlobalConfig,
  GroupFileRule,
  RunStats,
  ScannedFile,
  TriggerContext,
} from '../types';
import { matchesFile } from './rule-matcher';
import { isTtlEligible, sortRules, stopOnMatch } from './rule-engine-helpers';

function resolveDryRun(rule: GroupFileRule, global: GlobalConfig): boolean {
  return rule.dryRun ?? global.defaults?.dryRun ?? false;
}

function resolveMaxActionsPerRun(
  rule: GroupFileRule,
  global: GlobalConfig,
): number | undefined {
  return (
    rule.limits?.maxActionsPerRun ?? global.defaults?.limits?.maxActionsPerRun
  );
}

function triggerMatchesContext(
  triggers: GroupFileRule['triggers'],
  ctx: TriggerContext,
): boolean {
  return triggers.some((t) => t.type === ctx);
}

function countDryRunAction(
  stats: RunStats,
  rule: GroupFileRule,
): void {
  stats.matched += 1;
  if (rule.action.type === 'move') {
    stats.moved += 1;
  } else {
    stats.deleted += 1;
  }
}

function applyExecuteResult(
  stats: RunStats,
  result: 'moved' | 'deleted' | 'skipped' | 'error',
): void {
  stats.matched += 1;
  switch (result) {
    case 'moved':
      stats.moved += 1;
      break;
    case 'deleted':
      stats.deleted += 1;
      break;
    case 'skipped':
      stats.skipped += 1;
      break;
    case 'error':
      stats.errors += 1;
      break;
  }
}

function logDryRunAction(
  logger: PluginLogger | undefined,
  rule: GroupFileRule,
  file: ScannedFile,
): void {
  logger?.info(
    `[dry-run] rule=${rule.id} file=${file.fileName} action=${rule.action.type}`,
  );
}

export async function runRules(opts: {
  ctx: TriggerContext;
  global: GlobalConfig;
  groupId: string;
  rules: GroupFileRule[];
  files: ScannedFile[];
  now?: number;
  logger?: PluginLogger;
  execute: (
    rule: GroupFileRule,
    file: ScannedFile,
  ) => Promise<'moved' | 'deleted' | 'skipped' | 'error'>;
}): Promise<RunStats> {
  const now = opts.now ?? Date.now();
  const stats: RunStats = {
    scanned: opts.files.length,
    matched: 0,
    moved: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
  };

  const activeRules = sortRules(
    opts.rules.filter((r) => r.enabled && triggerMatchesContext(r.triggers, opts.ctx)),
  );

  let actionsRemaining: number | undefined;

  for (const file of opts.files) {
    for (const rule of activeRules) {
      if (!matchesFile(rule.match, file)) continue;

      const effectiveTtl = rule.ttl ?? opts.global.defaults?.ttl;
      const ttlMs =
        effectiveTtl !== undefined ? durationToMs(effectiveTtl) : undefined;
      if (!isTtlEligible(file.updatedAt, ttlMs, now)) continue;

      if (actionsRemaining === undefined) {
        actionsRemaining = resolveMaxActionsPerRun(rule, opts.global);
      }
      if (actionsRemaining !== undefined && actionsRemaining <= 0) continue;

      const dryRun = resolveDryRun(rule, opts.global);
      if (dryRun) {
        logDryRunAction(opts.logger, rule, file);
        countDryRunAction(stats, rule);
        if (actionsRemaining !== undefined) actionsRemaining -= 1;
        if (stopOnMatch(rule)) break;
        continue;
      }

      try {
        const result = await opts.execute(rule, file);
        applyExecuteResult(stats, result);
      } catch (error) {
        opts.logger?.error(
          `规则执行失败 rule=${rule.id} file=${file.fileName}:`,
          error,
        );
        applyExecuteResult(stats, 'error');
      }
      if (actionsRemaining !== undefined) actionsRemaining -= 1;
      if (stopOnMatch(rule)) break;
    }
  }

  return stats;
}
