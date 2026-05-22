import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import {
  createGroupFileFolder,
  deleteGroupFile,
  getGroupFilesByFolder,
  getGroupRootFiles,
  moveGroupFile,
  type GroupFileListItem,
  type GroupFolderItem,
} from './group-file-api';
import type { GlobalConfig, GroupFileRule, ScannedFile } from '../types';

const LIST_FILE_COUNT = 50;

export type ActionResult =
  | { ok: true; dryRun: true }
  | { ok: true; action: 'deleted' }
  | { ok: true; action: 'moved' }
  | { ok: true; action: 'skipped'; reason: 'conflict' | 'no_target_folder' }
  | { ok: false; error: string };

export type ActionApi = {
  getRoot(
    groupId: string,
    fileCount: number,
  ): Promise<{ files: GroupFileListItem[]; folders: GroupFolderItem[] }>;
  getFolder(
    groupId: string,
    folderId: string,
    fileCount: number,
  ): Promise<{ files: GroupFileListItem[]; folders: GroupFolderItem[] }>;
  deleteFile(groupId: string, fileId: string): Promise<unknown>;
  createFolder(
    groupId: string,
    folderName: string,
  ): Promise<{ groupItem?: { folder_id?: string } }>;
  moveFile(params: {
    group_id: string;
    file_id: string;
    current_parent_directory: string;
    target_parent_directory: string;
  }): Promise<{ ok?: boolean }>;
};

export type ExecuteActionOpts = {
  groupId: string;
  global: GlobalConfig;
  rule: GroupFileRule;
  file: ScannedFile;
};

function resolveDryRun(rule: GroupFileRule, global: GlobalConfig): boolean {
  return rule.dryRun ?? global.defaults?.dryRun ?? false;
}

function resolveCreateFolder(rule: GroupFileRule, global: GlobalConfig): boolean {
  if (rule.action.type !== 'move') return false;
  return rule.action.createFolderIfMissing ?? global.defaults?.createFolderIfMissing ?? true;
}

function resolveConflict(rule: GroupFileRule): 'skip' | 'rename' | 'overwrite' {
  if (rule.action.type !== 'move') return 'skip';
  return rule.action.conflict ?? 'skip';
}

function hasNameConflict(files: GroupFileListItem[], fileName: string): boolean {
  return files.some((f) => f.file_name === fileName);
}

function findFreeFileName(files: GroupFileListItem[], fileName: string): string {
  if (!hasNameConflict(files, fileName)) return fileName;
  const dot = fileName.lastIndexOf('.');
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot >= 0 ? fileName.slice(dot) : '';
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!hasNameConflict(files, candidate)) return candidate;
  }
  return fileName;
}

async function resolveTargetFolder(
  api: ActionApi,
  groupId: string,
  targetFolderName: string,
  createFolder: boolean,
): Promise<{ folderId: string | null; targetFiles: GroupFileListItem[] }> {
  const root = await api.getRoot(groupId, LIST_FILE_COUNT);
  let folder = root.folders.find((f) => f.folder_name === targetFolderName);

  if (!folder && createFolder) {
    const created = await api.createFolder(groupId, targetFolderName);
    const createdId = created.groupItem?.folder_id;
    if (createdId) {
      const sub = await api.getFolder(groupId, createdId, LIST_FILE_COUNT);
      return { folderId: createdId, targetFiles: sub.files };
    }
    const rootAgain = await api.getRoot(groupId, LIST_FILE_COUNT);
    folder = rootAgain.folders.find((f) => f.folder_name === targetFolderName);
  }

  if (!folder) {
    return { folderId: null, targetFiles: [] };
  }

  const sub = await api.getFolder(groupId, folder.folder_id, LIST_FILE_COUNT);
  return { folderId: folder.folder_id, targetFiles: sub.files };
}

async function executeMove(
  api: ActionApi,
  groupId: string,
  rule: GroupFileRule,
  file: ScannedFile,
  global: GlobalConfig,
): Promise<ActionResult> {
  if (rule.action.type !== 'move') {
    return { ok: false, error: 'invalid move action' };
  }

  const createFolder = resolveCreateFolder(rule, global);
  const conflict = resolveConflict(rule);
  const { folderId, targetFiles } = await resolveTargetFolder(
    api,
    groupId,
    rule.action.targetFolderName,
    createFolder,
  );

  if (!folderId) {
    return { ok: true, action: 'skipped', reason: 'no_target_folder' };
  }

  if (conflict === 'skip' && hasNameConflict(targetFiles, file.fileName)) {
    return { ok: true, action: 'skipped', reason: 'conflict' };
  }

  if (conflict === 'rename') {
    findFreeFileName(targetFiles, file.fileName);
  }

  try {
    const res = await api.moveFile({
      group_id: String(groupId),
      file_id: file.fileId,
      current_parent_directory: file.parentFolderId,
      target_parent_directory: folderId,
    });
    if (conflict === 'overwrite' && res.ok === false) {
      return { ok: true, action: 'skipped', reason: 'conflict' };
    }
    return { ok: true, action: 'moved' };
  } catch {
    if (conflict === 'overwrite') {
      return { ok: true, action: 'skipped', reason: 'conflict' };
    }
    return { ok: false, error: 'move failed' };
  }
}

export async function executeAction(api: ActionApi, opts: ExecuteActionOpts): Promise<ActionResult> {
  const { groupId, global, rule, file } = opts;

  if (resolveDryRun(rule, global)) {
    return { ok: true, dryRun: true };
  }

  if (rule.action.type === 'delete') {
    await api.deleteFile(groupId, file.fileId);
    return { ok: true, action: 'deleted' };
  }

  return executeMove(api, groupId, rule, file, global);
}

export function createActionApi(ctx: NapCatPluginContext): ActionApi {
  return {
    getRoot: (groupId, fileCount) => getGroupRootFiles(ctx, groupId, fileCount),
    getFolder: (groupId, folderId, fileCount) => getGroupFilesByFolder(ctx, groupId, folderId, fileCount),
    deleteFile: (groupId, fileId) => deleteGroupFile(ctx, groupId, fileId),
    createFolder: (groupName, folderName) => createGroupFileFolder(ctx, groupName, folderName),
    moveFile: (params) => moveGroupFile(ctx, params),
  };
}

export function createActionExecutor(ctx: NapCatPluginContext) {
  const api = createActionApi(ctx);
  return (opts: ExecuteActionOpts) => executeAction(api, opts);
}
