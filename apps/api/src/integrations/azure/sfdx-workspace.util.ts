import { existsSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

export function resolveSfdxWorkspace(
  workspaceDir: string,
  manifestPath: string,
): { projectRoot: string; manifestRelative: string } {
  const root = resolve(workspaceDir);
  const manifestAbs = resolve(root, manifestPath);
  if (!existsSync(manifestAbs)) {
    throw new Error(
      `package.xml not found at "${manifestPath}" in the checked-out branch. ` +
        'Confirm the branch contains CoreFlex Onboarding/manifest/package.xml (or set manifestPath).',
    );
  }

  let dir = dirname(manifestAbs);
  while (dir.length >= root.length) {
    if (existsSync(join(dir, 'sfdx-project.json'))) {
      return {
        projectRoot: dir,
        manifestRelative: relative(dir, manifestAbs).split(/[/\\]/).join('/'),
      };
    }
    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (existsSync(join(root, 'sfdx-project.json'))) {
    return { projectRoot: root, manifestRelative: manifestPath.replace(/\\/g, '/') };
  }

  throw new Error(
    'Checked-out repository does not contain sfdx-project.json near the manifest. ' +
      'Ensure the Azure repo is a valid Salesforce DX project.',
  );
}
