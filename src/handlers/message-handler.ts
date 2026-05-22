import type { OB11Message, OB11MessageFile, OB11PostSendMsg } from 'napcat-types/napcat-onebot';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { ConfigLoader } from '../config/loader';
import {
  createActionExecutor,
  type ActionResult,
} from '../core/action-executor';
import { fileKindFromFileName } from '../core/file-kind';
import { scanGroupFiles, createScanner } from '../core/group-file-scanner';
import { resolveNotificationMessage } from '../core/notifications';
import { toMs } from '../core/parse-timestamp';
import { runRules } from '../core/rule-engine';
import { sortRules } from '../core/rule-engine-helpers';
import { pluginState } from '../core/state';
import type { GlobalConfig, GroupFileRule, ScannedFile, TriggerContext } from '../types';

type OB11MessageFileSegment = OB11MessageFile & {
  data: OB11MessageFile['data'] & {
    file_id?: string;
    file_size?: number;
  };
};

function scannedFileFromUpload(
  event: OB11Message,
  seg: OB11MessageFileSegment,
): ScannedFile | null {
  const fileId = seg.data?.file_id;
  if (!fileId) return null;
  const fileName = seg.data?.name || seg.data?.file || 'unknown';
  const sizeBytes = Number(seg.data?.file_size) || 0;
  const updatedAt = toMs(Number(event.time) || 0);
  return {
    fileId: String(fileId),
    fileName: String(fileName),
    sizeBytes,
    updatedAt,
    parentFolderId: '/',
    kind: fileKindFromFileName(String(fileName)),
  };
}

function findFileSegment(event: OB11Message): OB11MessageFileSegment | undefined {
  const segs = event.message;
  if (!Array.isArray(segs)) return undefined;
  const seg = segs.find((s) => s.type === 'file');
  if (!seg || seg.type !== 'file') return undefined;
  return seg as OB11MessageFileSegment;
}

function mapActionResult(result: ActionResult): 'moved' | 'deleted' | 'skipped' | 'error' {
  if (!result.ok) return 'error';
  if ('dryRun' in result) return 'skipped';
  return result.action;
}

function resolveMaxFilesScanned(
  rules: GroupFileRule[],
  global: GlobalConfig,
  ctx: TriggerContext,
): number | undefined {
  const active = rules.filter(
    (r) => r.enabled && r.triggers.some((t) => t.type === ctx),
  );
  let max: number | undefined = global.defaults?.limits?.maxFilesScannedPerRun;
  for (const rule of active) {
    const limit =
      rule.limits?.maxFilesScannedPerRun ??
      global.defaults?.limits?.maxFilesScannedPerRun;
    if (limit !== undefined) {
      max = max === undefined ? limit : Math.max(max, limit);
    }
  }
  return max;
}

export async function sendReply(
  ctx: NapCatPluginContext,
  event: OB11Message,
  message: OB11PostSendMsg['message'],
): Promise<boolean> {
  try {
    const params: OB11PostSendMsg = {
      message,
      message_type: event.message_type,
      ...(event.message_type === 'group' && event.group_id
        ? { group_id: String(event.group_id) }
        : {}),
      ...(event.message_type === 'private' && event.user_id
        ? { user_id: String(event.user_id) }
        : {}),
    };
    await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
    return true;
  } catch (error) {
    pluginState.logger.error('发送消息失败:', error);
    return false;
  }
}

export async function sendGroupMessage(
  ctx: NapCatPluginContext,
  groupId: number | string,
  message: OB11PostSendMsg['message'],
): Promise<boolean> {
  try {
    const params: OB11PostSendMsg = {
      message,
      message_type: 'group',
      group_id: String(groupId),
    };
    await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
    return true;
  } catch (error) {
    pluginState.logger.error('发送群消息失败:', error);
    return false;
  }
}

export function isAdmin(event: OB11Message): boolean {
  if (event.message_type !== 'group') return true;
  const role = (event.sender as Record<string, unknown>)?.role;
  return role === 'admin' || role === 'owner';
}

export async function handleMessage(
  ctx: NapCatPluginContext,
  event: OB11Message,
): Promise<void> {
  try {
    if (event.message_type !== 'group' || !event.group_id) return;

    const groupId = String(event.group_id);
    const rawMessage = (event.raw_message || '').trim();
    const loader = new ConfigLoader(ctx.dataPath);
    const global = loader.loadGlobal();

    const fileSeg = findFileSegment(event);
    if (fileSeg) {
      const group = loader.loadGroup(groupId);
      if (!group || !group.enabled) return;

      const scannedFile = scannedFileFromUpload(event, fileSeg);
      if (!scannedFile) {
        ctx.logger.warn(`群 ${groupId} 文件消息缺少 file_id，跳过规则处理`);
        return;
      }

      const executor = createActionExecutor(ctx);
      await runRules({
        ctx: 'onFileUpload',
        global,
        groupId,
        rules: group.rules,
        files: [scannedFile],
        logger: ctx.logger,
        execute: async (rule, file) => {
          const result = await executor({ groupId, global, rule, file });
          return mapActionResult(result);
        },
      });
      return;
    }

    if (rawMessage === '/clean') {
      const group = loader.loadGroup(groupId);
      if (!group || !group.enabled) return;

      if (!isAdmin(event)) {
        return;
      }

      const scanner = createScanner(ctx);
      const maxFiles = resolveMaxFilesScanned(group.rules, global, 'manual');
      const files = await scanGroupFiles(scanner, groupId, maxFiles, ctx.logger);

      const executor = createActionExecutor(ctx);
      const stats = await runRules({
        ctx: 'manual',
        global,
        groupId,
        rules: group.rules,
        files,
        logger: ctx.logger,
        execute: async (rule, file) => {
          const result = await executor({ groupId, global, rule, file });
          return mapActionResult(result);
        },
      });

      const manualRules = group.rules.filter(
        (r) => r.enabled && r.triggers.some((t) => t.type === 'manual'),
      );
      const notifyRule = sortRules(manualRules)[0];
      if (notifyRule) {
        const msg = resolveNotificationMessage(notifyRule, global, stats);
        if (msg) await sendReply(ctx, event, msg);
      }
    }
  } catch (error) {
    pluginState.logger.error('处理消息时出错:', error);
  }
}
