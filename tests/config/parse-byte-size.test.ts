import { describe, it, expect } from 'vitest';
import { byteSizeToNumber, parseByteSize } from '../../src/config/parse-byte-size';

describe('parseByteSize', () => {
  it('parses plain number as bytes', () => {
    expect(byteSizeToNumber(1024)).toBe(1024);
  });
  it('parses KB binary', () => {
    expect(byteSizeToNumber('10KB')).toBe(10 * 1024);
  });
  it('parses MB', () => {
    expect(byteSizeToNumber('2MB')).toBe(2 * 1024 * 1024);
  });
  it('rejects invalid suffix', () => {
    expect(() => parseByteSize('10XB')).toThrow();
  });
});
