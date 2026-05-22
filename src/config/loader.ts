import fs from 'fs';
import path from 'path';
import type { PluginLogger } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { GlobalConfig, GroupConfig } from '../types';
import { validateGlobalConfig, validateGroupConfig } from './validate';

export class ConfigLoader {
  constructor(private readonly dataPath: string) {}

  globalPath(): string {
    return path.join(this.dataPath, 'global.json');
  }

  groupsDir(): string {
    return path.join(this.dataPath, 'groups');
  }

  loadGlobal(): GlobalConfig {
    const p = this.globalPath();
    if (!fs.existsSync(p)) return { enabled: true };
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return validateGlobalConfig(raw);
  }

  loadGroup(groupId: string): GroupConfig | null {
    const p = path.join(this.groupsDir(), `${groupId}.json`);
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return validateGroupConfig(raw);
  }

  loadAllGroups(logger?: PluginLogger): Map<string, GroupConfig> {
    const dir = this.groupsDir();
    const out = new Map<string, GroupConfig>();
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const groupId = name.replace(/\.json$/i, '');
      try {
        const cfg = this.loadGroup(groupId);
        if (cfg) out.set(groupId, cfg);
      } catch (error) {
        logger?.warn(`群配置无效，已跳过 ${name}:`, error);
      }
    }
    return out;
  }

  ensureDirs(): void {
    fs.mkdirSync(this.groupsDir(), { recursive: true });
  }
}
