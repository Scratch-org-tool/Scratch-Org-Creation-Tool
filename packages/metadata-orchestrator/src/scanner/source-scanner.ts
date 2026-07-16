import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ManifestMember } from '../parser/package-parser';

const METADATA_DIR_NAMES = ['main/default', 'default'];

/** Map folder names under force-app to Salesforce metadata types */
const FOLDER_TO_TYPE: Record<string, string> = {
  classes: 'ApexClass',
  triggers: 'ApexTrigger',
  objects: 'CustomObject',
  lwc: 'LightningComponentBundle',
  aura: 'AuraDefinitionBundle',
  flows: 'Flow',
  layouts: 'Layout',
  permissionsets: 'PermissionSet',
  profiles: 'Profile',
  flexipages: 'FlexiPage',
  tabs: 'CustomTab',
  applications: 'CustomApplication',
  labels: 'CustomLabels',
  staticresources: 'StaticResource',
  contentassets: 'ContentAsset',
  remoteSiteSettings: 'RemoteSiteSetting',
  namedCredentials: 'NamedCredential',
  externalCredentials: 'ExternalCredential',
  customMetadata: 'CustomMetadata',
  globalValueSets: 'GlobalValueSet',
  standardValueSets: 'StandardValueSet',
  queues: 'Queue',
  groups: 'Group',
  roles: 'Role',
  workflows: 'Workflow',
  approvalProcesses: 'ApprovalProcess',
  email: 'EmailTemplate',
  reports: 'Report',
  dashboards: 'Dashboard',
  documents: 'Document',
  weblinks: 'CustomPageWebLink',
  pages: 'ApexPage',
  components: 'ApexComponent',
};

export interface ScannedComponent {
  metadataType: string;
  apiName: string;
  filePath: string;
}

export class SourceScanner {
  private readonly index = new Map<string, ScannedComponent>();

  scanProject(projectRoot: string): Map<string, ScannedComponent> {
    this.index.clear();
    const forceAppRoots = this.findForceAppRoots(projectRoot);
    for (const root of forceAppRoots) {
      this.scanDirectory(root, projectRoot);
    }
    return new Map(this.index);
  }

  expandWildcards(
    members: ManifestMember[],
    projectRoot: string,
  ): ScannedComponent[] {
    const index = this.scanProject(projectRoot);
    const results: ScannedComponent[] = [];

    for (const member of members) {
      if (!member.isWildcard) {
        const key = `${member.metadataType}:${member.apiName}`;
        const hit = index.get(key);
        if (hit) {
          results.push(hit);
        } else {
          results.push({
            metadataType: member.metadataType,
            apiName: member.apiName,
            filePath: this.guessPath(projectRoot, member.metadataType, member.apiName),
          });
        }
        continue;
      }

      const prefix = member.apiName === '*' ? '' : member.apiName.replace(/\.\*$/, '');
      for (const [key, comp] of index) {
        if (comp.metadataType !== member.metadataType) continue;
        if (!prefix || comp.apiName.startsWith(prefix)) {
          results.push(comp);
        }
      }
    }

    return results;
  }

  private findForceAppRoots(projectRoot: string): string[] {
    const roots: string[] = [];
    const forceApp = path.join(projectRoot, 'force-app');
    if (fs.existsSync(forceApp)) {
      for (const entry of fs.readdirSync(forceApp, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const metaDir of METADATA_DIR_NAMES) {
          const candidate = path.join(forceApp, entry.name, metaDir);
          if (fs.existsSync(candidate)) roots.push(candidate);
        }
      }
    }
    const sfdx = path.join(projectRoot, 'sfdx-source');
    if (fs.existsSync(sfdx)) roots.push(sfdx);
    if (roots.length === 0 && fs.existsSync(projectRoot)) {
      roots.push(projectRoot);
    }
    return roots;
  }

  private scanDirectory(metaRoot: string, projectRoot: string): void {
    const walk = (dir: string, metadataType?: string, apiName?: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      const folderName = path.basename(dir);
      const typeFromFolder = FOLDER_TO_TYPE[folderName] ?? metadataType;

      if (typeFromFolder && !metadataType) {
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const name = entry.name;
            const ext = this.primaryExtension(typeFromFolder);
            const file = ext
              ? path.join(full, `${name}${ext}`)
              : this.findMetaXml(full);
            const filePath = file && fs.existsSync(file) ? file : full;
            this.register(typeFromFolder, name, path.relative(projectRoot, filePath));
          } else if (entry.name.endsWith('-meta.xml')) {
            const name = this.metadataApiName(entry.name);
            this.register(typeFromFolder, name, path.relative(projectRoot, full));
          } else {
            const extension = this.primaryExtension(typeFromFolder);
            if (extension && entry.name.endsWith(extension)) {
              this.register(
                typeFromFolder,
                entry.name.slice(0, -extension.length),
                path.relative(projectRoot, full),
              );
            }
          }
        }
        return;
      }

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, metadataType, apiName);
        else if (entry.name.endsWith('-meta.xml') && metadataType && apiName) {
          this.register(metadataType, apiName, path.relative(projectRoot, full));
        }
      }
    };

    walk(metaRoot);
  }

  private register(metadataType: string, apiName: string, filePath: string): void {
    const key = `${metadataType}:${apiName}`;
    if (!this.index.has(key)) {
      this.index.set(key, { metadataType, apiName, filePath });
    }
  }

  private primaryExtension(metadataType: string): string | null {
    if (metadataType === 'ApexClass') return '.cls';
    if (metadataType === 'ApexTrigger') return '.trigger';
    if (metadataType === 'ApexPage') return '.page';
    if (metadataType === 'ApexComponent') return '.component';
    return null;
  }

  private findMetaXml(dir: string): string | null {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('-meta.xml')) return path.join(dir, f);
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private metadataApiName(fileName: string): string {
    return fileName
      .replace(/-meta\.xml$/, '')
      .replace(/\.(cls|trigger|page|component|flow|layout|profile|permissionset|flexipage)$/, '');
  }

  private guessPath(projectRoot: string, metadataType: string, apiName: string): string {
    const folder = Object.entries(FOLDER_TO_TYPE).find(([, t]) => t === metadataType)?.[0];
    if (!folder) return '';
    return path.join('force-app', 'main', 'default', folder, `${apiName}-meta.xml`);
  }
}

export const sourceScanner = new SourceScanner();
