import { describe, it, expect, vi } from 'vitest';
import { scanGroupFiles, type GroupFileApi } from '../../src/core/group-file-scanner';
import type { GroupFileListItem } from '../../src/core/group-file-api';

const rootFile: GroupFileListItem = {
  file_id: 'f-root',
  file_name: 'root.txt',
  file_size: 100,
  modify_time: 1_700_000_000,
};

const subFile: GroupFileListItem = {
  file_id: 'f-sub',
  file_name: 'clip.mp4',
  file_size: 2000,
  upload_time: 1_700_000_100,
};

function mockApi(overrides?: Partial<GroupFileApi>): GroupFileApi {
  return {
    getRoot: vi.fn().mockResolvedValue({
      files: [rootFile],
      folders: [{ folder_id: 'dir1', folder_name: 'Videos' }],
    }),
    getFolder: vi.fn().mockResolvedValue({ files: [subFile] }),
    ...overrides,
  };
}

describe('scanGroupFiles', () => {
  it('returns root file and folder file as ScannedFile entries', async () => {
    const api = mockApi();
    const result = await scanGroupFiles(api, '12345');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      fileId: 'f-root',
      fileName: 'root.txt',
      sizeBytes: 100,
      parentFolderId: '/',
      kind: 'document',
    });
    expect(result[0].updatedAt).toBe(1_700_000_000_000);
    expect(result[1]).toMatchObject({
      fileId: 'f-sub',
      fileName: 'clip.mp4',
      sizeBytes: 2000,
      parentFolderId: 'dir1',
      folderName: 'Videos',
      kind: 'video',
    });
    expect(result[1].updatedAt).toBe(1_700_000_100_000);
    expect(api.getRoot).toHaveBeenCalledWith('12345', 50);
    expect(api.getFolder).toHaveBeenCalledWith('12345', 'dir1', 50);
  });

  it('respects maxFilesScannedPerRun', async () => {
    const api = mockApi({
      getRoot: vi.fn().mockResolvedValue({
        files: [rootFile, { ...rootFile, file_id: 'f2', file_name: 'b.txt' }],
        folders: [{ folder_id: 'dir1', folder_name: 'Videos' }],
      }),
      getFolder: vi.fn().mockResolvedValue({ files: [subFile] }),
    });
    const result = await scanGroupFiles(api, '12345', 2);

    expect(result).toHaveLength(2);
    expect(api.getFolder).not.toHaveBeenCalled();
  });
});
