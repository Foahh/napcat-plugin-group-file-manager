import type { ByteSize } from '../types';

const SUFFIX: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
};

export function byteSizeToNumber(v: ByteSize): number {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid byte size: ${v}`);
    return v;
  }
  const m = /^(\d+(?:\.\d+)?)(B|KB|MB|GB)$/i.exec(v.trim());
  if (!m) throw new Error(`Invalid byte size string: ${v}`);
  const n = Number(m[1]);
  const unit = m[2].toUpperCase();
  return n * SUFFIX[unit];
}

export function parseByteSize(raw: unknown): ByteSize {
  if (typeof raw === 'number') {
    byteSizeToNumber(raw);
    return raw;
  }
  if (typeof raw === 'string') {
    byteSizeToNumber(raw as ByteSize);
    return raw as ByteSize;
  }
  throw new Error('ByteSize must be number or string');
}
