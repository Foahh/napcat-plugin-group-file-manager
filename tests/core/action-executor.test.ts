import { describe, it, expect, vi } from 'vitest';
import { executeAction, type ActionApi } from '../../src/core/action-executor';
import type { GlobalConfig, GroupFileRule, ScannedFile } from '../../src/types';

const file: ScannedFile = {
  fileId: 'f1',
  fileName: 'clip.mp4',
  sizeBytes: 1000,
  updatedAt: 0,
  parentFolderId: '/',
  kind: 'video',
};

const baseRule: GroupFileRule = {
  id: 'r1',
  enabled: true,
  triggers: [{ type: 'manual' }],
  match: { all: [] },
  action: { type: 'delete' },
};

function mockApi(overrides?: Partial<ActionApi>): ActionApi {
  return {
    getRoot: vi.fn().mockResolvedValue({ files: [], folders: [] }),
    getFolder: vi.fn().mockResolvedValue({ files: [], folders: [] }),
    deleteFile: vi.fn().mockResolvedValue({}),
    createFolder: vi.fn().mockResolvedValue({ groupItem: { folder_id: 'new-dir' } }),
    moveFile: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe('executeAction', () => {
  it('dryRun: true → no API calls, returns { ok: true, dryRun: true }', async () => {
    const api = mockApi();
    const global: GlobalConfig = { enabled: true, defaults: { dryRun: false } };
    const rule: GroupFileRule = { ...baseRule, dryRun: true, action: { type: 'delete' } };

    const result = await executeAction(api, { groupId: '12345', global, rule, file });

    expect(result).toEqual({ ok: true, dryRun: true });
    expect(api.deleteFile).not.toHaveBeenCalled();
    expect(api.getRoot).not.toHaveBeenCalled();
    expect(api.moveFile).not.toHaveBeenCalled();
  });

  it('delete → calls deleteGroupFile', async () => {
    const api = mockApi();
    const global: GlobalConfig = { enabled: true };
    const rule: GroupFileRule = { ...baseRule, action: { type: 'delete' } };

    const result = await executeAction(api, { groupId: '12345', global, rule, file });

    expect(result).toEqual({ ok: true, action: 'deleted' });
    expect(api.deleteFile).toHaveBeenCalledWith('12345', 'f1');
    expect(api.getRoot).not.toHaveBeenCalled();
  });

  it('move + createFolderIfMissing → creates folder then moves', async () => {
    const api = mockApi({
      getRoot: vi
        .fn()
        .mockResolvedValueOnce({ files: [], folders: [] })
        .mockResolvedValueOnce({
          files: [],
          folders: [{ folder_id: 'new-dir', folder_name: 'Archive' }],
        }),
      getFolder: vi.fn().mockResolvedValue({ files: [], folders: [] }),
      createFolder: vi.fn().mockResolvedValue({ groupItem: { folder_id: 'new-dir' } }),
    });
    const global: GlobalConfig = { enabled: true };
    const rule: GroupFileRule = {
      ...baseRule,
      action: { type: 'move', targetFolderName: 'Archive', createFolderIfMissing: true },
    };

    const result = await executeAction(api, { groupId: '12345', global, rule, file });

    expect(result).toEqual({ ok: true, action: 'moved' });
    expect(api.createFolder).toHaveBeenCalledWith('12345', 'Archive');
    expect(api.moveFile).toHaveBeenCalledWith({
      group_id: '12345',
      file_id: 'f1',
      current_parent_directory: '/',
      target_parent_directory: 'new-dir',
    });
  });

  it('conflict: skip when target has same file_name → skip', async () => {
    const api = mockApi({
      getRoot: vi.fn().mockResolvedValue({
        files: [],
        folders: [{ folder_id: 'dir1', folder_name: 'Archive' }],
      }),
      getFolder: vi.fn().mockResolvedValue({
        files: [{ file_id: 'other', file_name: 'clip.mp4', file_size: 1 }],
        folders: [],
      }),
    });
    const global: GlobalConfig = { enabled: true };
    const rule: GroupFileRule = {
      ...baseRule,
      action: { type: 'move', targetFolderName: 'Archive', conflict: 'skip' },
    };

    const result = await executeAction(api, { groupId: '12345', global, rule, file });

    expect(result).toEqual({ ok: true, action: 'skipped', reason: 'conflict' });
    expect(api.createFolder).not.toHaveBeenCalled();
    expect(api.moveFile).not.toHaveBeenCalled();
  });
});
