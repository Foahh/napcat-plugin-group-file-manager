# 群文件管理（NapCat 插件）

为 QQ 群文件提供**可配置的自动整理**：按规则移动或删除文件，支持上传时即时处理、定时扫描与管理员手动清理。

| 要求 | 说明 |
|------|------|
| NapCat | ≥ 4.14.0 |
| 配置方式 | JSON 文件 |
| 许可证 | [MIT](LICENSE) |

---

## 快速开始

### 1. 安装插件

任选其一：

- **Release**：从 [GitHub Releases](https://github.com/Foahh/napcat-plugin-group-file-manager/releases) 下载，将解压后的内容放入 NapCat 的 `plugins` 目录。
- **自行构建**：在本仓库根目录执行 `npm install`（首次）与 `npm run build`，将 `dist/` 目录中的文件复制到 `plugins`。

在 NapCat 中启用插件后，确认插件已加载（名称：**群文件管理**）。

### 2. 放置配置文件

插件使用 NapCat 为每个插件分配的数据目录（`dataPath`）。将本仓库 [`examples/`](examples/) 复制到该目录（**不要**在仓库内保存真实群号配置；根目录 `data/` 已 `.gitignore`）：

```text
{插件 dataPath}/
  global.json
  groups/
    {群号}.json
```

例如群号为 `987654321` 时，将 `groups/123456789.json` 重命名为 `groups/987654321.json` 并修改规则。模板见 [`examples/groups/123456789.json`](examples/groups/123456789.json)。

> **提示**：`dataPath` 的具体路径取决于 NapCat 的安装方式，一般在 NapCat 的插件数据目录下、以本插件名命名的子文件夹中。修改 JSON 后无需重启，下次触发时会自动重新加载。

### 3. 验证是否生效

1. 确认 `global.json` 中 `"enabled": true`，且对应群的 `groups/{群号}.json` 中 `"enabled": true`。
2. 首次建议将 `global.json` 的 `defaults.dryRun` 设为 `true`，观察日志与群内摘要，确认规则匹配正确后再改回 `false`。
3. 在群内上传一个 `.mp4` 测试文件（若使用示例规则），应被移动到 `Multimedia` 文件夹。
4. 群管理员在群内发送 `/clean`，可触发带 `manual` 触发的规则（如示例中的过期视频清理）。

---

## 能做什么

| 能力 | 说明 |
|------|------|
| 上传即整理 | 成员上传群文件时，执行带 `onFileUpload` 触发的规则（如按扩展名移动到指定文件夹）。 |
| 定时清理 | 带 `schedule` 的规则按设定间隔全量扫描群文件并执行（内置每 60 秒检查是否到期）。 |
| 手动清理 | 群管理员发送 `/clean`，执行带 `manual` 触发的规则。 |
| 安全试运行 | `dryRun` 模式下只记录拟执行操作，不实际移动或删除。 |
| 单群独立配置 | 每个群一份 `groups/{群号}.json`，互不影响。 |

---

## 工作方式概览

```text
上传文件 ──► onFileUpload 规则 ──► 匹配 ──► 移动 / 删除
                    ▲
定时（schedule）────┤──► 全量扫描群文件 ──► 匹配（含 TTL）──► 动作
管理员 /clean ──────┘      manual 规则
```

- **匹配**：按文件名、扩展名、大小、所在文件夹、文件类型（`kind`）等条件组合判断。
- **TTL 删除**：仅当 `文件更新时间 + ttl ≤ 当前时间` 时才会删除，用于“保留 N 天后清理”类规则。
- **优先级**：同一文件可被多条规则匹配；`priority` 数值越小越先执行。单条规则可设 `stopProcessingOnMatch: true` 以阻止后续规则继续处理该文件。

---

## 配置说明

### 目录与生效条件

| 文件 | 作用 |
|------|------|
| `global.json` | 总开关、`defaults` 默认值（dryRun、限额、通知等）。 |
| `groups/{群号}.json` | 该群的规则列表；文件名即群号（不含 `.json`）。 |

- `global.json` 中 `enabled: false` → 插件不执行任何操作。
- 某群无对应 JSON，或该群配置 `enabled: false` → 不处理该群。
- 配置在每次上传、定时任务、`/clean` 时重新读取，改完保存即可生效。

### 全局配置 `global.json`

```json
{
  "enabled": true,
  "defaults": {
    "createFolderIfMissing": true,
    "dryRun": false,
    "limits": {
      "maxFilesScannedPerRun": 500,
      "maxActionsPerRun": 50
    },
    "notification": {
      "enabled": true,
      "level": "summary"
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `defaults.dryRun` | 全局试运行；单条规则可单独覆盖。 |
| `defaults.createFolderIfMissing` | 移动时目标文件夹不存在则自动创建。 |
| `defaults.limits.maxFilesScannedPerRun` | 单次运行最多扫描文件数。 |
| `defaults.limits.maxActionsPerRun` | 单次运行最多执行移动/删除次数。 |
| `defaults.notification.level` | `silent` / `summary` / `verbose` |

### 群规则 `groups/{群号}.json`

完整示例见 [`examples/groups/123456789.json`](examples/groups/123456789.json)。结构如下：

```json
{
  "enabled": true,
  "rules": [
    {
      "id": "move-multimedia",
      "enabled": true,
      "priority": 10,
      "triggers": [{ "type": "onFileUpload" }],
      "match": {
        "any": [
          { "type": "extension", "values": ["mp4", "mp3", "avi", "mkv"] }
        ]
      },
      "action": {
        "type": "move",
        "targetFolderName": "Multimedia",
        "conflict": "skip"
      }
    },
    {
      "id": "cleanup-video-7d",
      "enabled": true,
      "priority": 20,
      "triggers": [
        { "type": "schedule", "every": { "value": 6, "unit": "hours" } },
        { "type": "manual" }
      ],
      "match": {
        "all": [
          { "type": "extension", "values": ["mp4"] },
          { "type": "kind", "values": ["video"] }
        ]
      },
      "ttl": { "value": 7, "unit": "days" },
      "action": { "type": "delete" }
    }
  ]
}
```

示例规则含义：

- **move-multimedia**：上传 `mp4` / `mp3` / `avi` / `mkv` 时移到 `Multimedia` 文件夹；同名文件则跳过（`conflict: "skip"`）。
- **cleanup-video-7d**：每 6 小时扫描一次，或由管理员 `/clean` 触发；删除已存在满 7 天的 `.mp4` 视频类文件。

### 触发器 `triggers`

| `type` | 何时执行 |
|--------|----------|
| `onFileUpload` | 群消息包含文件上传（`file` 消息段）时，针对该文件评估规则。 |
| `schedule` | 按 `every` 间隔定时全量扫描；需配合 `ttl` 或扫描类匹配条件。 |
| `manual` | 仅当群管理员发送 `/clean` 时执行。 |

一条规则可声明多个触发器，例如同时支持定时删除与手动 `/clean`。

`schedule.every` 的时间单位：`seconds` | `minutes` | `hours` | `days`。

> 定时任务的“上次执行时间”保存在内存中，**重启 NapCat 后** 可能在间隔未到前再执行一次，属正常现象。

### 匹配条件 `match`

在 `all`（全部满足）、`any`（满足其一）、`none`（均不满足）下组合条件：

| `type` | 字段 | 说明 |
|--------|------|------|
| `extension` | `values` | 扩展名列表（不含点），如 `["pdf", "zip"]`。 |
| `name` | `match`, `value` | `glob` / `regex` / `contains` / `equals`。 |
| `size` | `operator`, `value` | `gt` / `gte` / `lt` / `lte`；或 `between` + `min` / `max`。大小可用数字（字节）或 `"10MB"` 等形式。 |
| `folder` | `folder` | `{ "type": "root" }` / `{ "type": "all" }` / `{ "type": "folder", "name": "文件夹名" }`。 |
| `kind` | `values` | `image` / `video` / `audio` / `document` / `archive` / `other`。 |

### 动作 `action`

**移动** `move`：

| 字段 | 说明 |
|------|------|
| `targetFolderName` | 目标文件夹名称。 |
| `createFolderIfMissing` | 可覆盖全局默认。 |
| `conflict` | `skip`（跳过）/ `rename`（重命名）/ `overwrite`（覆盖）。 |

**删除** `delete`：通常与 `ttl` 一起用于过期清理。

### 单条规则可选字段

| 字段 | 说明 |
|------|------|
| `priority` | 数字越小越先执行，默认按声明顺序。 |
| `ttl` | 仅对删除类规则有意义；文件须“已存在超过该时长”才会被删。 |
| `dryRun` | 覆盖全局，仅记录不执行。 |
| `stopProcessingOnMatch` | 匹配后不再执行同次运行中优先级更低的规则。 |
| `limits` / `notification` | 覆盖全局 `defaults` 中的同名项。 |

---

## 群命令 `/clean`

| 项目 | 说明 |
|------|------|
| 格式 | 消息内容为 `/clean`（去除首尾空格后完全匹配，区分大小写）。 |
| 权限 | 仅群管理员或群主；其他人会收到：`无权限执行 /clean`。 |
| 行为 | 全量扫描群文件，仅执行带 `manual` 触发的规则。 |
| 通知 | 若开启通知，可能回复扫描/匹配/移动/删除等汇总。 |

---

## 试运行（dry-run）

不修改群文件，仅在日志（及可选群内通知）中记录拟执行操作。

优先级（后者覆盖前者）：单条规则 `dryRun` → `global.defaults.dryRun` → 默认 `false`。

建议上线前先将 `global.json` 中 `defaults.dryRun` 设为 `true`，确认规则无误后再关闭。

---

## 开发与构建

```bash
npm install          # 首次
npm run build        # 产出 dist/
npm run typecheck
npm test
```

`watch` 模式：`npm run watch`。

## 相关链接

- NapCat：[NapCatQQ](https://github.com/NapNeko/NapCatQQ)
