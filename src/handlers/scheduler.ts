/**
 * 主调度器 — 60s tick，按规则间隔扫描群文件
 */

import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { ConfigLoader } from '../config/loader';
import { durationToMs } from '../config/parse-duration';
import {
  createActionExecutor,
  type ActionResult,
} from '../core/action-executor';
import { createScanner, scanGroupFiles } from '../core/group-file-scanner';
import { runRules } from '../core/rule-engine';
import { pluginState } from '../core/state';
import type { GlobalConfig, GroupFileRule, ScheduleTrigger } from '../types';

const MASTER_TICK_MS = 60_000;

function mapActionResult(result: ActionResult): 'moved' | 'deleted' | 'skipped' | 'error' {
  if (!result.ok) return 'error';
  if ('dryRun' in result) return 'skipped';
  return result.action;
}

function resolveMaxFilesScanned(
  rule: GroupFileRule,
  global: GlobalConfig,
): number | undefined {
  return (
    rule.limits?.maxFilesScannedPerRun ??
    global.defaults?.limits?.maxFilesScannedPerRun
  );
}

async function tickSchedule(ctx: NapCatPluginContext): Promise<void> {
  const loader = new ConfigLoader(ctx.dataPath);
  const global = loader.loadGlobal();
  if (!global.enabled) return;

  const now = Date.now();
  const scanner = createScanner(ctx);
  const executor = createActionExecutor(ctx);

  for (const [groupId, group] of loader.loadAllGroups()) {
    if (group.enabled === false) continue;

    try {
      for (const rule of group.rules) {
        if (!rule.enabled) continue;

        const trigger = rule.triggers.find(
          (t): t is ScheduleTrigger => t.type === 'schedule',
        );
        if (!trigger) continue;

        const key = pluginState.scheduleKey(groupId, rule.id);
        const everyMs = durationToMs(trigger.every);
        if (now - pluginState.getLastRun(key) < everyMs) continue;

        const maxFiles = resolveMaxFilesScanned(rule, global);
        const files = await scanGroupFiles(scanner, groupId, maxFiles);

        await runRules({
          ctx: 'schedule',
          global,
          groupId,
          rules: [rule],
          files,
          now,
          execute: async (r, file) => {
            const result = await executor({ groupId, global, rule: r, file });
            return mapActionResult(result);
          },
        });

        pluginState.setLastRun(key, now);
      }
    } catch (error) {
      pluginState.logger.error(`调度执行失败 (群 ${groupId}):`, error);
    }
  }
}

export function startScheduler(ctx: NapCatPluginContext): void {
  if (pluginState.schedulerTimer) return;
  pluginState.schedulerTimer = setInterval(() => {
    void tickSchedule(ctx);
  }, MASTER_TICK_MS);
}

export function stopScheduler(): void {
  if (pluginState.schedulerTimer) {
    clearInterval(pluginState.schedulerTimer);
    pluginState.schedulerTimer = null;
  }
}
