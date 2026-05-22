import { describe, it, expect } from 'vitest';
import { matchesFile } from '../../src/core/rule-matcher';
import type { ScannedFile, FileMatcher } from '../../src/types';

const base: ScannedFile = {
  fileId: '1',
  fileName: 'test.MP4',
  sizeBytes: 1000,
  updatedAt: 0,
  parentFolderId: '/',
  kind: 'video',
};

describe('matchesFile', () => {
  it('none rejects when any none matches', () => {
    const m: FileMatcher = { none: [{ type: 'extension', values: ['mp4'] }] };
    expect(matchesFile(m, base)).toBe(false);
  });
  it('any matches one extension', () => {
    const m: FileMatcher = { any: [{ type: 'extension', values: ['mp4'], caseSensitive: false }] };
    expect(matchesFile(m, base)).toBe(true);
  });
  it('name glob', () => {
    const m: FileMatcher = { all: [{ type: 'name', match: 'glob', value: '*.mp4' }] };
    expect(matchesFile(m, base)).toBe(true);
  });
  it('size gt', () => {
    const m: FileMatcher = { all: [{ type: 'size', operator: 'gt', value: 500 }] };
    expect(matchesFile(m, base)).toBe(true);
  });
  it('folder root', () => {
    const m: FileMatcher = { all: [{ type: 'folder', folder: { type: 'root' } }] };
    expect(matchesFile(m, base)).toBe(true);
  });
});
