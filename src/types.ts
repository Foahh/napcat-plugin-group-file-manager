export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export type Duration = {
  value: number;
  unit: DurationUnit;
};

export type ByteSize =
  | number
  | `${number}B`
  | `${number}KB`
  | `${number}MB`
  | `${number}GB`;

export type GlobalConfig = {
  enabled: boolean;
  defaults?: {
    dryRun?: boolean;
    ttl?: Duration;
    createFolderIfMissing?: boolean;
    limits?: {
      maxFilesScannedPerRun?: number;
      maxActionsPerRun?: number;
    };
    notification?: NotificationConfig;
  };
};

export type GroupConfig = {
  enabled: boolean;
  rules: GroupFileRule[];
};

export type GroupFileRule = {
  id: string;
  name?: string;
  enabled: boolean;
  priority?: number;
  triggers: RuleTrigger[];
  match: FileMatcher;
  ttl?: Duration;
  action: FileAction;
  stopProcessingOnMatch?: boolean;
  dryRun?: boolean;
  limits?: {
    maxFilesScannedPerRun?: number;
    maxActionsPerRun?: number;
  };
  notification?: NotificationConfig;
};

export type RuleTrigger =
  | ManualTrigger
  | ScheduleTrigger
  | OnFileUploadTrigger;

export type ManualTrigger = { type: 'manual' };

export type ScheduleTrigger = {
  type: 'schedule';
  every: Duration;
};

export type OnFileUploadTrigger = { type: 'onFileUpload' };

export type FileMatcher = {
  all?: FileCondition[];
  any?: FileCondition[];
  none?: FileCondition[];
};

export type FileCondition =
  | FileNameCondition
  | FileExtensionCondition
  | FileSizeCondition
  | FileFolderCondition
  | FileKindCondition;

export type FileNameCondition = {
  type: 'name';
  match: 'glob' | 'regex' | 'contains' | 'equals';
  value: string;
  caseSensitive?: boolean;
};

export type FileExtensionCondition = {
  type: 'extension';
  values: string[];
  caseSensitive?: boolean;
};

export type FileSizeCondition =
  | {
      type: 'size';
      operator: 'gt' | 'gte' | 'lt' | 'lte';
      value: ByteSize;
    }
  | {
      type: 'size';
      operator: 'between';
      min: ByteSize;
      max: ByteSize;
    };

export type FileFolderCondition = {
  type: 'folder';
  folder: GroupFileFolderSelector;
};

export type FileKindCondition = {
  type: 'kind';
  values: FileKind[];
};

export type FileKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'other';

export type GroupFileFolderSelector =
  | { type: 'all' }
  | { type: 'root' }
  | { type: 'folder'; name: string };

export type FileAction = MoveFileAction | DeleteFileAction;

export type MoveFileAction = {
  type: 'move';
  targetFolderName: string;
  createFolderIfMissing?: boolean;
  conflict?: 'skip' | 'rename' | 'overwrite';
};

export type DeleteFileAction = { type: 'delete' };

export type NotificationConfig = {
  enabled?: boolean;
  level?: 'silent' | 'summary' | 'verbose';
};

export type ScannedFile = {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  updatedAt: number;
  parentFolderId: string;
  folderName?: string;
  kind: FileKind;
};

export type TriggerContext = 'onFileUpload' | 'schedule' | 'manual';

export type RunStats = {
  scanned: number;
  matched: number;
  moved: number;
  deleted: number;
  skipped: number;
  errors: number;
};
