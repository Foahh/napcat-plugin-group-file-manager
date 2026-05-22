import type { FileKind } from '../types';

const EXT_MAP: Record<string, FileKind> = {
  // image
  avif: 'image', bmp: 'image', gif: 'image', heic: 'image', heif: 'image',
  ico: 'image', jfif: 'image', jpeg: 'image', jpg: 'image', jpe: 'image',
  png: 'image', svg: 'image', svgz: 'image', tif: 'image', tiff: 'image',
  webp: 'image',
  // video
  '3gp': 'video', '3g2': 'video', asf: 'video', avi: 'video', f4v: 'video',
  flv: 'video', m2ts: 'video', m4v: 'video', mkv: 'video', mov: 'video',
  mp4: 'video', mpeg: 'video', mpg: 'video', mts: 'video', ogv: 'video',
  rm: 'video', rmvb: 'video', ts: 'video', vob: 'video', webm: 'video',
  wmv: 'video',
  // audio
  aac: 'audio', ac3: 'audio', aiff: 'audio', aif: 'audio', amr: 'audio',
  ape: 'audio', flac: 'audio', m4a: 'audio', mid: 'audio', midi: 'audio',
  mp3: 'audio', oga: 'audio', ogg: 'audio', opus: 'audio', wav: 'audio',
  wma: 'audio',
  // document
  csv: 'document', doc: 'document', docm: 'document', docx: 'document',
  epub: 'document', htm: 'document', html: 'document', md: 'document',
  mobi: 'document', odt: 'document', pdf: 'document', pot: 'document',
  potx: 'document', pps: 'document', ppsx: 'document', ppt: 'document',
  pptm: 'document', pptx: 'document', rtf: 'document', txt: 'document',
  xls: 'document', xlsm: 'document', xlsx: 'document',
  // archive
  '7z': 'archive', apk: 'archive', arj: 'archive', bz2: 'archive',
  cab: 'archive', deb: 'archive', dmg: 'archive', gz: 'archive', iso: 'archive',
  jar: 'archive', lz: 'archive', lz4: 'archive', rar: 'archive', rpm: 'archive',
  tar: 'archive', tbz2: 'archive', tgz: 'archive', txz: 'archive', xz: 'archive',
  zip: 'archive', zst: 'archive',
};

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

export function fileKindFromFileName(fileName: string): FileKind {
  return EXT_MAP[extensionOf(fileName)] ?? 'other';
}
