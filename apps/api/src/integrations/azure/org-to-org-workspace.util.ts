import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_MANIFEST_REL = 'manifest/package.xml';

export function bootstrapOrgToOrgWorkspace(
  workDir: string,
  manifestContent: string,
  manifestRelative = DEFAULT_MANIFEST_REL,
): { projectRoot: string; manifestRelative: string; manifestAbsolutePath: string } {
  fs.mkdirSync(workDir, { recursive: true });

  const sfdxProject = {
    packageDirectories: [{ path: 'force-app', default: true }],
    name: 'org-to-org-retrieve',
    namespace: '',
    sfdcLoginUrl: 'https://login.salesforce.com',
    sourceApiVersion: '62.0',
  };
  fs.writeFileSync(
    path.join(workDir, 'sfdx-project.json'),
    JSON.stringify(sfdxProject, null, 2),
    'utf8',
  );
  fs.mkdirSync(path.join(workDir, 'force-app'), { recursive: true });

  const manifestAbs = path.join(workDir, manifestRelative);
  fs.mkdirSync(path.dirname(manifestAbs), { recursive: true });
  fs.writeFileSync(manifestAbs, manifestContent, 'utf8');

  return {
    projectRoot: workDir,
    manifestRelative: manifestRelative.replace(/\\/g, '/'),
    manifestAbsolutePath: manifestAbs,
  };
}
