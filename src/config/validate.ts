import type {
  ByteSize,
  Duration,
  FileAction,
  FileCondition,
  FileMatcher,
  GlobalConfig,
  GroupConfig,
  GroupFileFolderSelector,
  GroupFileRule,
  NotificationConfig,
  RuleTrigger,
} from '../types';
import { parseByteSize } from './parse-byte-size';
import { parseDuration } from './parse-duration';

const FILE_KINDS = ['image', 'video', 'audio', 'document', 'archive', 'other'] as const;
const NAME_MATCH_MODES = ['glob', 'regex', 'contains', 'equals'] as const;
const SIZE_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'between'] as const;
const CONFLICT_MODES = ['skip', 'rename', 'overwrite'] as const;
const NOTIFICATION_LEVELS = ['silent', 'summary', 'verbose'] as const;
const TRIGGER_TYPES = ['manual', 'schedule', 'onFileUpload'] as const;

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function rejectUnknown(obj: Record<string, unknown>, allowed: readonly string[], path = ''): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      const field = path ? `${path}.${key}` : key;
      throw new Error(`Unknown field: ${field}`);
    }
  }
}

function requireBoolean(raw: unknown, field: string): boolean {
  if (typeof raw !== 'boolean') throw new Error(`${field} must be a boolean`);
  return raw;
}

function requireString(raw: unknown, field: string): string {
  if (typeof raw !== 'string' || raw.length === 0) throw new Error(`${field} must be a non-empty string`);
  return raw;
}

function requireNumber(raw: unknown, field: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`${field} must be a number`);
  return raw;
}

function requireArray(raw: unknown, field: string): unknown[] {
  if (!Array.isArray(raw)) throw new Error(`${field} must be an array`);
  return raw;
}

function requireEnum<T extends string>(raw: unknown, field: string, allowed: readonly T[]): T {
  if (typeof raw !== 'string' || !allowed.includes(raw as T)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return raw as T;
}

function validateOptionalBoolean(raw: unknown, field: string): boolean | undefined {
  if (raw === undefined) return undefined;
  return requireBoolean(raw, field);
}

function validateOptionalNumber(raw: unknown, field: string): number | undefined {
  if (raw === undefined) return undefined;
  return requireNumber(raw, field);
}

function validateDuration(raw: unknown, field: string): Duration {
  try {
    return parseDuration(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${field}: ${msg}`);
  }
}

function validateByteSize(raw: unknown, field: string): ByteSize {
  try {
    return parseByteSize(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${field}: ${msg}`);
  }
}

function validateNotification(raw: unknown, path: string): NotificationConfig {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  rejectUnknown(raw, ['enabled', 'level'], path);
  const out: NotificationConfig = {};
  const enabled = validateOptionalBoolean(raw.enabled, `${path}.enabled`);
  if (enabled !== undefined) out.enabled = enabled;
  if (raw.level !== undefined) {
    out.level = requireEnum(raw.level, `${path}.level`, NOTIFICATION_LEVELS);
  }
  return out;
}

function validateLimits(raw: unknown, path: string): GroupFileRule['limits'] {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  rejectUnknown(raw, ['maxFilesScannedPerRun', 'maxActionsPerRun'], path);
  const out: NonNullable<GroupFileRule['limits']> = {};
  const maxFiles = validateOptionalNumber(raw.maxFilesScannedPerRun, `${path}.maxFilesScannedPerRun`);
  if (maxFiles !== undefined) out.maxFilesScannedPerRun = maxFiles;
  const maxActions = validateOptionalNumber(raw.maxActionsPerRun, `${path}.maxActionsPerRun`);
  if (maxActions !== undefined) out.maxActionsPerRun = maxActions;
  return out;
}

function validateFolderSelector(raw: unknown, path: string): GroupFileFolderSelector {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const type = requireEnum(raw.type, `${path}.type`, ['all', 'root', 'folder'] as const);
  if (type === 'all') {
    rejectUnknown(raw, ['type'], path);
    return { type: 'all' };
  }
  if (type === 'root') {
    rejectUnknown(raw, ['type'], path);
    return { type: 'root' };
  }
  rejectUnknown(raw, ['type', 'name'], path);
  return { type: 'folder', name: requireString(raw.name, `${path}.name`) };
}

function validateFileCondition(raw: unknown, path: string): FileCondition {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const type = requireEnum(raw.type, `${path}.type`, [
    'name',
    'extension',
    'size',
    'folder',
    'kind',
  ] as const);

  switch (type) {
    case 'name': {
      rejectUnknown(raw, ['type', 'match', 'value', 'caseSensitive'], path);
      const out: FileCondition = {
        type: 'name',
        match: requireEnum(raw.match, `${path}.match`, NAME_MATCH_MODES),
        value: requireString(raw.value, `${path}.value`),
      };
      const caseSensitive = validateOptionalBoolean(raw.caseSensitive, `${path}.caseSensitive`);
      if (caseSensitive !== undefined) out.caseSensitive = caseSensitive;
      return out;
    }
    case 'extension': {
      rejectUnknown(raw, ['type', 'values', 'caseSensitive'], path);
      const values = requireArray(raw.values, `${path}.values`);
      if (values.length === 0) throw new Error(`${path}.values must be a non-empty array`);
      const parsed: string[] = [];
      for (let i = 0; i < values.length; i++) {
        const v = requireString(values[i], `${path}.values[${i}]`);
        if (v.startsWith('.')) {
          throw new Error(`Extension value must not start with a dot: ${v}`);
        }
        parsed.push(v);
      }
      const out: FileCondition = { type: 'extension', values: parsed };
      const caseSensitive = validateOptionalBoolean(raw.caseSensitive, `${path}.caseSensitive`);
      if (caseSensitive !== undefined) out.caseSensitive = caseSensitive;
      return out;
    }
    case 'size': {
      rejectUnknown(raw, ['type', 'operator', 'value', 'min', 'max'], path);
      const operator = requireEnum(raw.operator, `${path}.operator`, SIZE_OPERATORS);
      if (operator === 'between') {
        return {
          type: 'size',
          operator: 'between',
          min: validateByteSize(raw.min, `${path}.min`),
          max: validateByteSize(raw.max, `${path}.max`),
        };
      }
      return {
        type: 'size',
        operator,
        value: validateByteSize(raw.value, `${path}.value`),
      };
    }
    case 'folder': {
      rejectUnknown(raw, ['type', 'folder'], path);
      return { type: 'folder', folder: validateFolderSelector(raw.folder, `${path}.folder`) };
    }
    case 'kind': {
      rejectUnknown(raw, ['type', 'values'], path);
      const values = requireArray(raw.values, `${path}.values`);
      if (values.length === 0) throw new Error(`${path}.values must be a non-empty array`);
      const parsed = values.map((v, i) =>
        requireEnum(v, `${path}.values[${i}]`, FILE_KINDS),
      );
      return { type: 'kind', values: parsed };
    }
  }
}

function validateConditionList(raw: unknown, field: string): FileCondition[] {
  const arr = requireArray(raw, field);
  return arr.map((item, i) => validateFileCondition(item, `${field}[${i}]`));
}

function validateFileMatcher(raw: unknown, path: string): FileMatcher {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  rejectUnknown(raw, ['all', 'any', 'none'], path);
  const out: FileMatcher = {};
  if (raw.all !== undefined) out.all = validateConditionList(raw.all, `${path}.all`);
  if (raw.any !== undefined) out.any = validateConditionList(raw.any, `${path}.any`);
  if (raw.none !== undefined) out.none = validateConditionList(raw.none, `${path}.none`);
  return out;
}

function validateTrigger(raw: unknown, path: string): RuleTrigger {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const type = requireEnum(raw.type, `${path}.type`, TRIGGER_TYPES);
  switch (type) {
    case 'manual':
      rejectUnknown(raw, ['type'], path);
      return { type: 'manual' };
    case 'onFileUpload':
      rejectUnknown(raw, ['type'], path);
      return { type: 'onFileUpload' };
    case 'schedule':
      rejectUnknown(raw, ['type', 'every'], path);
      return { type: 'schedule', every: validateDuration(raw.every, `${path}.every`) };
  }
}

function validateAction(raw: unknown, path: string): FileAction {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const type = requireEnum(raw.type, `${path}.type`, ['move', 'delete'] as const);
  if (type === 'delete') {
    rejectUnknown(raw, ['type'], path);
    return { type: 'delete' };
  }
  rejectUnknown(raw, ['type', 'targetFolderName', 'createFolderIfMissing', 'conflict'], path);
  const out: FileAction = {
    type: 'move',
    targetFolderName: requireString(raw.targetFolderName, `${path}.targetFolderName`),
  };
  const createFolderIfMissing = validateOptionalBoolean(
    raw.createFolderIfMissing,
    `${path}.createFolderIfMissing`,
  );
  if (createFolderIfMissing !== undefined) out.createFolderIfMissing = createFolderIfMissing;
  if (raw.conflict !== undefined) {
    out.conflict = requireEnum(raw.conflict, `${path}.conflict`, CONFLICT_MODES);
  }
  return out;
}

function validateRule(raw: unknown, index: number): GroupFileRule {
  const path = `rules[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  rejectUnknown(
    raw,
    [
      'id',
      'name',
      'enabled',
      'priority',
      'triggers',
      'match',
      'ttl',
      'action',
      'stopProcessingOnMatch',
      'dryRun',
      'limits',
      'notification',
    ],
    path,
  );

  const id = requireString(raw.id, `${path}.id`);
  const enabled = requireBoolean(raw.enabled, `${path}.enabled`);

  const triggersRaw = raw.triggers;
  if (triggersRaw === undefined) throw new Error(`${path}.triggers is required`);
  const triggersArr = requireArray(triggersRaw, `${path}.triggers`);
  if (triggersArr.length === 0) throw new Error(`${path}.triggers must be a non-empty array`);
  const triggers = triggersArr.map((t, i) => validateTrigger(t, `${path}.triggers[${i}]`));

  if (raw.match === undefined) throw new Error(`${path}.match is required`);
  const match = validateFileMatcher(raw.match, `${path}.match`);

  if (raw.action === undefined) throw new Error(`${path}.action is required`);
  const action = validateAction(raw.action, `${path}.action`);

  const out: GroupFileRule = { id, enabled, triggers, match, action };

  if (raw.name !== undefined) out.name = requireString(raw.name, `${path}.name`);
  if (raw.priority !== undefined) out.priority = requireNumber(raw.priority, `${path}.priority`);
  if (raw.ttl !== undefined) out.ttl = validateDuration(raw.ttl, `${path}.ttl`);
  const stopProcessingOnMatch = validateOptionalBoolean(
    raw.stopProcessingOnMatch,
    `${path}.stopProcessingOnMatch`,
  );
  if (stopProcessingOnMatch !== undefined) out.stopProcessingOnMatch = stopProcessingOnMatch;
  const dryRun = validateOptionalBoolean(raw.dryRun, `${path}.dryRun`);
  if (dryRun !== undefined) out.dryRun = dryRun;
  if (raw.limits !== undefined) out.limits = validateLimits(raw.limits, `${path}.limits`);
  if (raw.notification !== undefined) {
    out.notification = validateNotification(raw.notification, `${path}.notification`);
  }

  return out;
}

function validateDefaults(raw: unknown): NonNullable<GlobalConfig['defaults']> {
  if (!isRecord(raw)) throw new Error('defaults must be an object');
  rejectUnknown(raw, ['dryRun', 'ttl', 'createFolderIfMissing', 'limits', 'notification'], 'defaults');
  const out: NonNullable<GlobalConfig['defaults']> = {};
  const dryRun = validateOptionalBoolean(raw.dryRun, 'defaults.dryRun');
  if (dryRun !== undefined) out.dryRun = dryRun;
  if (raw.ttl !== undefined) out.ttl = validateDuration(raw.ttl, 'defaults.ttl');
  const createFolderIfMissing = validateOptionalBoolean(
    raw.createFolderIfMissing,
    'defaults.createFolderIfMissing',
  );
  if (createFolderIfMissing !== undefined) out.createFolderIfMissing = createFolderIfMissing;
  if (raw.limits !== undefined) out.limits = validateLimits(raw.limits, 'defaults.limits');
  if (raw.notification !== undefined) {
    out.notification = validateNotification(raw.notification, 'defaults.notification');
  }
  return out;
}

export function validateGlobalConfig(raw: unknown): GlobalConfig {
  if (!isRecord(raw)) throw new Error('Global config must be an object');
  rejectUnknown(raw, ['enabled', 'defaults']);
  const enabled = requireBoolean(raw.enabled, 'enabled');
  const out: GlobalConfig = { enabled };
  if (raw.defaults !== undefined) out.defaults = validateDefaults(raw.defaults);
  return out;
}

export function validateGroupConfig(raw: unknown): GroupConfig {
  if (!isRecord(raw)) throw new Error('Group config must be an object');
  rejectUnknown(raw, ['enabled', 'rules']);
  const enabled = requireBoolean(raw.enabled, 'enabled');
  const rulesRaw = requireArray(raw.rules, 'rules');
  const seenIds = new Set<string>();
  const rules: GroupFileRule[] = rulesRaw.map((rule, index) => {
    const validated = validateRule(rule, index);
    if (seenIds.has(validated.id)) {
      throw new Error(`Duplicate rule id: ${validated.id}`);
    }
    seenIds.add(validated.id);
    return validated;
  });
  return { enabled, rules };
}
