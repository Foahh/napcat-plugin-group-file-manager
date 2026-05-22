import type {
  NapCatPluginContext,
  PluginLogger,
} from 'napcat-types/napcat-onebot/network/plugin/types';
import type { GroupFileListItem, GroupFolderItem } from './group-file-api';
import { getGroupRootFiles, getGroupFilesByFolder } from './group-file-api';
import { fileKindFromFileName } from './file-kind';
import { toMs } from './parse-timestamp';
import type { ScannedFile } from '../types';

export type GroupFileApi = {
  getRoot(groupId: string, fileCount: number): Promise<{ files: GroupFileListItem[]; folders: GroupFolderItem[] }>;
  getFolder(groupId: string, folderId: string, fileCount: number): Promise<{ files: GroupFileListItem[] }>;
};

function mapFile(
  file: GroupFileListItem,
  parentFolderId: string,
  folderName?: string,
): ScannedFile {
  return {
    fileId: file.file_id,
    fileName: file.file_name,
    sizeBytes: file.file_size,
    updatedAt: toMs(file.modify_time || file.upload_time || 0),
    parentFolderId,
    folderName,
    kind: fileKindFromFileName(file.file_name),
  };
}

export async function scanGroupFiles(
  api: GroupFileApi,
  groupId: string,
  maxFiles?: number,
  logger?: PluginLogger,
): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  const limit = maxFiles ?? Infinity;
  const root = await api.getRoot(groupId, Math.min(limit, 50));
  for (const f of root.files) {
    if (out.length >= limit) break;
    out.push(mapFile(f, '/', undefined));
  }
  for (const folder of root.folders) {
    if (out.length >= limit) break;
    try {
      const sub = await api.getFolder(
        groupId,
        folder.folder_id,
        Math.min(limit - out.length, 50),
      );
      for (const f of sub.files) {
        if (out.length >= limit) break;
        out.push(mapFile(f, folder.folder_id, folder.folder_name));
      }
    } catch (error) {
      logger?.warn(
        `扫描群组 ${groupId} 文件夹 ${folder.folder_name} (${folder.folder_id}) 失败，已跳过:`,
        error,
      );
    }
  }
  return out;
}

export function createScanner(ctx: NapCatPluginContext): GroupFileApi {
  return {
    getRoot: (groupId, fileCount) => getGroupRootFiles(ctx, groupId, fileCount),
    getFolder: async (groupId, folderId, fileCount) => {
      const res = await getGroupFilesByFolder(ctx, groupId, folderId, fileCount);
      return { files: res.files };
    },
  };
}
