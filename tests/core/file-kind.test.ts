import { describe, it, expect } from 'vitest';
import { fileKindFromFileName } from '../../src/core/file-kind';

describe('fileKindFromFileName', () => {
  it('maps mp4 to video', () => {
    expect(fileKindFromFileName('clip.mp4')).toBe('video');
  });
  it('maps zip to archive', () => {
    expect(fileKindFromFileName('x.zip')).toBe('archive');
  });
  it('unknown ext is other', () => {
    expect(fileKindFromFileName('foo.xyz')).toBe('other');
  });
});
