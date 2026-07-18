import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSfProjectRoot } from './sf-project-root.util';

describe('resolveSfProjectRoot', () => {
  it('walks up from the API directory to checked-in Salesforce assets', () => {
    const root = mkdtempSync(join(tmpdir(), 'sfcc-project-root-'));
    mkdirSync(join(root, 'apps', 'api'), { recursive: true });
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(root, 'config', 'project-scratch-def.json'), '{}');

    expect(resolveSfProjectRoot(join(root, 'apps', 'api'), '')).toBe(root);
  });

  it('honors an explicit project root', () => {
    expect(resolveSfProjectRoot('/tmp/current', '../mounted/project')).toBe(
      resolve('../mounted/project'),
    );
  });
});
