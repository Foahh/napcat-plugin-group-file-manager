import { describe, it, expect } from 'vitest';
import type { GlobalConfig, GroupFileRule, ScannedFile } from '../src/types';

describe('types contract', () => {
  it('GlobalConfig accepts defaults', () => {
    const g: GlobalConfig = { defaults: { dryRun: true } };
    expect(g.defaults?.dryRun).toBe(true);
  });

  it('ScannedFile has required fields', () => {
    const f: ScannedFile = {
      fileId: 'id',
      fileName: 'a.mp4',
      sizeBytes: 1,
      updatedAt: 1,
      parentFolderId: '/',
      kind: 'video',
    };
    expect(f.fileName).toBe('a.mp4');
  });
});
