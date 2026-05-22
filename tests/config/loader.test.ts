import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ConfigLoader } from '../../src/config/loader';

describe('ConfigLoader', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gfm-'));
    fs.writeFileSync(path.join(tmp, 'global.json'), JSON.stringify({ defaults: { dryRun: false } }));
    fs.mkdirSync(path.join(tmp, 'groups'));
    fs.writeFileSync(
      path.join(tmp, 'groups', '111.json'),
      JSON.stringify({
        enabled: true,
        rules: [{
          id: 'r1',
          enabled: true,
          triggers: [{ type: 'manual' }],
          match: {},
          action: { type: 'delete' },
        }],
      }),
    );
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('loads global and group by filename', () => {
    const loader = new ConfigLoader(tmp);
    const g = loader.loadGlobal();
    expect(g.defaults?.dryRun).toBe(false);
    const groups = loader.loadAllGroups();
    expect(groups.get('111')?.rules).toHaveLength(1);
  });
});

describe('ConfigLoader.initTemplates', () => {
  let dataDir: string;
  let pluginDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfm-data-'));
    pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfm-plugin-'));
    const templatesRoot = path.join(pluginDir, 'templates');
    fs.mkdirSync(path.join(templatesRoot, 'groups'), { recursive: true });
    fs.writeFileSync(
      path.join(templatesRoot, 'global.json'),
      JSON.stringify({ defaults: { dryRun: true } }),
    );
    fs.writeFileSync(
      path.join(templatesRoot, 'groups', '123456789.json'),
      JSON.stringify({ enabled: true, rules: [] }),
    );
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(pluginDir, { recursive: true, force: true });
  });

  it('copies template configs when data directory is empty', () => {
    const loader = new ConfigLoader(dataDir);
    loader.initTemplates(pluginDir);
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'global.json'), 'utf-8'))).toEqual({
      defaults: { dryRun: true },
    });
    expect(fs.existsSync(path.join(dataDir, 'groups', '123456789.json'))).toBe(true);
  });

  it('does not overwrite existing config files', () => {
    fs.writeFileSync(
      path.join(dataDir, 'global.json'),
      JSON.stringify({ defaults: { dryRun: false } }),
    );
    const loader = new ConfigLoader(dataDir);
    loader.initTemplates(pluginDir);
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'global.json'), 'utf-8'))).toEqual({
      defaults: { dryRun: false },
    });
  });

  it('no-ops when templates directory is missing', () => {
    const loader = new ConfigLoader(dataDir);
    loader.initTemplates(path.join(pluginDir, 'no-templates'));
    expect(fs.existsSync(path.join(dataDir, 'global.json'))).toBe(false);
  });
});
