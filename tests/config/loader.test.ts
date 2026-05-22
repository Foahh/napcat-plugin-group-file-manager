import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ConfigLoader } from '../../src/config/loader';

describe('ConfigLoader', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gfm-'));
    fs.writeFileSync(path.join(tmp, 'global.json'), JSON.stringify({ enabled: true }));
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
    expect(g.enabled).toBe(true);
    const groups = loader.loadAllGroups();
    expect(groups.get('111')?.rules).toHaveLength(1);
  });
});
