import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';

const call = async <T>(ctx: NapCatPluginContext, action: string, params: Record<string, unknown>): Promise<T> => {
  return (await ctx.actions.call(
    action as never,
    params as never,
    ctx.adapterName,
    ctx.pluginManager.config,
  )) as T;
};

export type GroupFileListItem = {
  file_id: string;
  file_name: string;
  file_size: number;
  modify_time?: number;
  upload_time?: number;
};

export type GroupFolderItem = {
  folder_id: string;
  folder_name: string;
};

export async function getGroupRootFiles(ctx: NapCatPluginContext, groupId: string, fileCount: number) {
  return call<{ files: GroupFileListItem[]; folders: GroupFolderItem[] }>(ctx, 'get_group_root_files', {
    group_id: String(groupId),
    file_count: fileCount,
  });
}

export async function getGroupFilesByFolder(
  ctx: NapCatPluginContext,
  groupId: string,
  folderId: string,
  fileCount: number,
) {
  return call<{ files: GroupFileListItem[]; folders: GroupFolderItem[] }>(ctx, 'get_group_files_by_folder', {
    group_id: String(groupId),
    folder_id: folderId,
    file_count: fileCount,
  });
}

export async function deleteGroupFile(ctx: NapCatPluginContext, groupId: string, fileId: string) {
  return call(ctx, 'delete_group_file', { group_id: String(groupId), file_id: fileId });
}

export async function createGroupFileFolder(ctx: NapCatPluginContext, groupId: string, folderName: string) {
  return call<{ groupItem?: { folder_id?: string } }>(ctx, 'create_group_file_folder', {
    group_id: String(groupId),
    folder_name: folderName,
  });
}

export async function moveGroupFile(
  ctx: NapCatPluginContext,
  params: {
    group_id: string;
    file_id: string;
    current_parent_directory: string;
    target_parent_directory: string;
  },
) {
  return call<{ ok?: boolean }>(ctx, 'move_group_file', params);
}

export async function renameGroupFile(
  ctx: NapCatPluginContext,
  params: {
    group_id: string;
    file_id: string;
    current_parent_directory: string;
    new_name: string;
  },
) {
  return call<{ ok?: boolean }>(ctx, 'rename_group_file', params);
}
