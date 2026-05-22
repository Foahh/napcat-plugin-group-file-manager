import { describe, it, expect } from 'vitest';
import { validateGlobalConfig, validateGroupConfig } from '../../src/config/validate';

describe('validateGroupConfig', () => {
  it('rejects duplicate rule ids', () => {
    expect(() =>
      validateGroupConfig({
        enabled: true,
        rules: [
          { id: 'a', enabled: true, triggers: [{ type: 'manual' }], match: {}, action: { type: 'delete' } },
          { id: 'a', enabled: true, triggers: [{ type: 'manual' }], match: {}, action: { type: 'delete' } },
        ],
      }),
    ).toThrow(/duplicate/i);
  });

  it('rejects extension with leading dot', () => {
    expect(() =>
      validateGroupConfig({
        enabled: true,
        rules: [{
          id: 'x',
          enabled: true,
          triggers: [{ type: 'manual' }],
          match: { all: [{ type: 'extension', values: ['.mp4'] }] },
          action: { type: 'delete' },
        }],
      }),
    ).toThrow(/dot/i);
  });

  it('rejects unknown top-level keys', () => {
    expect(() => validateGlobalConfig({ defaults: { dryRun: false }, extra: 1 })).toThrow(/unknown/i);
  });
});
