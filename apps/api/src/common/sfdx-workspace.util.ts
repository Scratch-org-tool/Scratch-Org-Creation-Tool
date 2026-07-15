import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export function resolveSfdxWorkspace(
  workspaceDir: string,
  manifestPath: string,
): { projectRoot: string; manifestRelative: string } {
  const root = resolve(workspaceDir);
  const manifestAbsolute = resolve(root, manifestPath);
  if (!manifestAbsolute.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error('Manifest path must remain inside the checked-out repository');
  }
  if (!existsSync(manifestAbsolute)) {
    throw new Error(
      `package.xml not found at "${manifestPath}" in the checked-out branch. ` +
        'Confirm the branch contains the configured manifest path.',
    );
  }

  let directory = dirname(manifestAbsolute);
  while (directory.length >= root.length) {
    if (existsSync(join(directory, 'sfdx-project.json'))) {
      return {
        projectRoot: directory,
        manifestRelative: relative(directory, manifestAbsolute).split(/[/\\]/).join('/'),
      };
    }
    if (directory === root) break;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  if (existsSync(join(root, 'sfdx-project.json'))) {
    return {
      projectRoot: root,
      manifestRelative: relative(root, manifestAbsolute).split(/[/\\]/).join('/'),
    };
  }

  throw new Error(
    'Checked-out repository does not contain sfdx-project.json near the manifest.',
  );
}
