# napcat-plugin-group-file-manager

NapCatQQ 群文件自动管理插件：按 JSON 规则对 QQ **群文件**执行移动或删除，支持上传触发、定时扫描与管理员手动清理。无 WebUI，不持久化单文件状态。

## 功能说明

- 每个群一份配置文件，规则可配置匹配条件、TTL、优先级与动作（`move` / `delete`）。
- **上传即处理**：成员发送 `file` 消息段（上传到群文件）时，执行带 `onFileUpload` 触发的规则。
- **定时扫描**：带 `schedule` 的规则由内置 60 秒主时钟按 `every` 间隔触发，全量扫描群文件后评估规则。
- **手动清理**：群管理员发送 `/clean`，仅执行带 `manual` 触发的规则（需全量扫描）。
- **无状态 TTL**：文件在 `updatedAt + ttl ≤ now` 时方可删除；不维护待处理队列。

示例配置见仓库 `data/global.json` 与 `data/groups/123456789.json`（将 `123456789` 替换为实际群号）。

## 配置目录（`dataPath`）

插件在 NapCat 中为每个插件分配独立数据目录 `ctx.dataPath`。将本仓库 `data/` 下的文件复制到该目录（路径因安装方式而异，一般为 NapCat 插件数据目录下的本插件子目录）：

```
{plugin.dataPath}/
  global.json          # 全局开关与默认值
  groups/
    {groupId}.json     # 群规则，文件名即群号，如 123456789.json
```

- 群号由文件名推断：`groups/123456789.json` → 群 `123456789`。
- 仅当存在对应 JSON 且 `GroupConfig.enabled !== false` 时处理该群。
- `global.json` 中 `enabled: false` 时，插件不执行任何规则。
- 每次上传、定时 tick、`/clean` 时重新读取 JSON（v1 无文件监视）。

### 全局配置示例（`global.json`）

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

### 群规则示例（`groups/123456789.json`）

- **move-multimedia**：上传 `mp4`/`mp3`/`avi`/`mkv` 时移动到文件夹 `Multimedia`，同名冲突则跳过。
- **cleanup-video-7d**：每 6 小时扫描（及管理员 `/clean`），删除已存在满 7 天的 `.mp4` 视频类文件。

完整示例见 [`data/groups/123456789.json`](data/groups/123456789.json)。

## 触发器

| 类型 | 说明 |
|------|------|
| `onFileUpload` | 群消息中含 `file` 段时，仅对该群、仅该触发类型的规则执行；通常用于即时移动（无 TTL）。 |
| `schedule` | 主时钟每 60 秒检查一次；当 `now - lastRunAt[groupId:ruleId] ≥ every` 时全量扫描并执行。`lastRunAt` 仅存内存，重启后可能提前跑一次。 |
| `manual` | 仅通过 `/clean` 触发，需配合 `GroupFileScanner` 全量扫描。 |

一条规则可声明多个触发器（如定时删除 + 管理员手动 `/clean`）。

## `/clean`（仅管理员）

- 消息须为 `/clean`（`trim` 后、区分大小写）。
- 发送者须为群 **管理员** 或 **群主**；否则回复一行：`无权限执行 /clean`。
- 执行带 `manual` 触发的规则；若开启通知，可回复扫描/匹配/移动/删除等汇总。

## 试运行（dry-run）

不修改群文件，仅记录拟执行动作：

```
rule.dryRun ?? global.defaults.dryRun ?? false
```

在 `global.json` 将 `defaults.dryRun` 设为 `true`，或在单条规则上设置 `"dryRun": true`，用于验证匹配与日志而不调用移动/删除 API。

## 构建与部署

```powershell
Set-Location D:\NapCat.Shell\plugins\napcat-plugin-group-file-manager
npm run build
```

产物在 `dist/`（`index.mjs` + `package.json`）。将 `dist/` 内容复制到 NapCat 的 `plugins` 目录，或从 [GitHub Release](https://github.com/Foahh/napcat-plugin-group-file-manager/releases) 下载解压。

在机器人主机上，把 `data/global.json` 与 `data/groups/{你的群号}.json` 放入该插件的 `dataPath`（可参考示例将 `123456789` 改为真实群号）。

要求 NapCat **≥ 4.14.0**（见 `package.json` 中 `napcat.minVersion`）。

## 手动联调清单

部署并完成配置后，建议按下列项验证：

- [ ] **上传移动**：启用 `move-multimedia`（无 TTL）。在群内上传 `.mp4` → 文件出现在 `Multimedia` 文件夹。
- [ ] **TTL 删除**：`cleanup-video-7d` 为 7 天 TTL。可临时将 TTL 改为 `{ "value": 1, "unit": "minutes" }` 加快验证。管理员发送 `/clean` → 过期文件被删除；非管理员应收到一行无权限提示。
- [ ] **dry-run**：`global.defaults.dryRun: true` → 仅日志，不移动/删除。
- [ ] **动作上限**：`maxActionsPerRun: 1` → 第二次匹配应被跳过。
- [ ] **单元测试**（本地）：`npm test` — 覆盖解析、匹配器、RuleEngine dry-run、冲突策略等。

## 开发与测试

```bash
npm run typecheck
npm test
```

## 许可证

MIT License
