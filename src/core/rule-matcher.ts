import wcmatch from 'wildcard-match';
import { byteSizeToNumber } from '../config/parse-byte-size';
import type {
  FileCondition,
  FileMatcher,
  ScannedFile,
} from '../types';
import { extensionOf } from './file-kind';

function foldCase(s: string): string {
  return s.toLowerCase();
}

function matchesNameCondition(
  condition: Extract<FileCondition, { type: 'name' }>,
  file: ScannedFile,
): boolean {
  const sensitive = condition.caseSensitive === true;
  const fileName = sensitive ? file.fileName : foldCase(file.fileName);
  const value = sensitive ? condition.value : foldCase(condition.value);

  switch (condition.match) {
    case 'glob':
      return wcmatch(value)(fileName);
    case 'regex': {
      try {
        const flags = sensitive ? '' : 'i';
        return new RegExp(condition.value, flags).test(file.fileName);
      } catch {
        return false;
      }
    }
    case 'contains':
      return fileName.includes(value);
    case 'equals':
      return fileName === value;
  }
}

function normalizeExtension(ext: string, caseSensitive: boolean): string {
  const stripped = ext.startsWith('.') ? ext.slice(1) : ext;
  return caseSensitive ? stripped : foldCase(stripped);
}

function matchesExtensionCondition(
  condition: Extract<FileCondition, { type: 'extension' }>,
  file: ScannedFile,
): boolean {
  const sensitive = condition.caseSensitive === true;
  const ext = extensionOf(file.fileName);
  const fileExt = sensitive ? ext : foldCase(ext);
  return condition.values.some(
    (v) => normalizeExtension(v, sensitive) === fileExt,
  );
}

function matchesSizeCondition(
  condition: Extract<FileCondition, { type: 'size' }>,
  file: ScannedFile,
): boolean {
  const size = file.sizeBytes;
  if (condition.operator === 'between') {
    const min = byteSizeToNumber(condition.min);
    const max = byteSizeToNumber(condition.max);
    return size >= min && size <= max;
  }
  const threshold = byteSizeToNumber(condition.value);
  switch (condition.operator) {
    case 'gt':
      return size > threshold;
    case 'gte':
      return size >= threshold;
    case 'lt':
      return size < threshold;
    case 'lte':
      return size <= threshold;
  }
}

function matchesFolderCondition(
  condition: Extract<FileCondition, { type: 'folder' }>,
  file: ScannedFile,
): boolean {
  const { folder } = condition;
  switch (folder.type) {
    case 'all':
      return true;
    case 'root':
      return file.parentFolderId === '/' || file.parentFolderId === '';
    case 'folder':
      return file.folderName === folder.name;
  }
}

function matchesKindCondition(
  condition: Extract<FileCondition, { type: 'kind' }>,
  file: ScannedFile,
): boolean {
  return condition.values.includes(file.kind);
}

function matchesCondition(condition: FileCondition, file: ScannedFile): boolean {
  switch (condition.type) {
    case 'name':
      return matchesNameCondition(condition, file);
    case 'extension':
      return matchesExtensionCondition(condition, file);
    case 'size':
      return matchesSizeCondition(condition, file);
    case 'folder':
      return matchesFolderCondition(condition, file);
    case 'kind':
      return matchesKindCondition(condition, file);
  }
}

export function matchesFile(matcher: FileMatcher, file: ScannedFile): boolean {
  if (matcher.none?.length) {
    if (matcher.none.some((c) => matchesCondition(c, file))) return false;
  }
  if (matcher.all?.length) {
    if (!matcher.all.every((c) => matchesCondition(c, file))) return false;
  }
  if (matcher.any?.length) {
    if (!matcher.any.some((c) => matchesCondition(c, file))) return false;
  }
  return true;
}
