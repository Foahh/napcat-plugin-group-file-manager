import { describe, it, expect } from 'vitest';
import { fileKindFromFileName } from '../../src/core/file-kind';

describe('fileKindFromFileName', () => {
  it('maps mp4 to video', () => {
    expect(fileKindFromFileName('clip.mp4')).toBe('video');
  });
  it('maps zip to archive', () => {
    expect(fileKindFromFileName('x.zip')).toBe('archive');
  });
  it('maps common extensions per kind', () => {
    expect(fileKindFromFileName('photo.heic')).toBe('image');
    expect(fileKindFromFileName('clip.webm')).toBe('video');
    expect(fileKindFromFileName('song.m4a')).toBe('audio');
    expect(fileKindFromFileName('sheet.xlsx')).toBe('document');
    expect(fileKindFromFileName('backup.tar.gz')).toBe('archive');
    expect(fileKindFromFileName('script.py')).toBe('other');
    expect(fileKindFromFileName('app.apk')).toBe('archive');
  });
  it('unknown ext is other', () => {
    expect(fileKindFromFileName('foo.xyz')).toBe('other');
  });
});
