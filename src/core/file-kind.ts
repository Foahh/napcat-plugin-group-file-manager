import type { FileKind } from '../types';

const EXT_MAP: Record<string, FileKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio',
  pdf: 'document', doc: 'document', docx: 'document', txt: 'document',
  zip: 'archive', rar: 'archive', '7z': 'archive',
};

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

export function fileKindFromFileName(fileName: string): FileKind {
  return EXT_MAP[extensionOf(fileName)] ?? 'other';
}
