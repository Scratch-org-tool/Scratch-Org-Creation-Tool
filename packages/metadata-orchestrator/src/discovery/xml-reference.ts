import * as fs from 'node:fs';
import type { MetadataRepository } from '../repository/metadata-repository';
import type { ScannedComponent } from '../scanner/source-scanner';

const XML_REF_PATTERNS: Array<{ regex: RegExp; resolve: (match: RegExpMatchArray, comp: ScannedComponent) => string | null }> = [
  {
    regex: /<object>([^<]+)<\/object>/gi,
    resolve: (m) => `CustomObject:${m[1]}`,
  },
  {
    regex: /<referenceTo>([^<]+)<\/referenceTo>/gi,
    resolve: (m) => `CustomObject:${m[1]}`,
  },
  {
    regex: /<apexClass>([^<]+)<\/apexClass>/gi,
    resolve: (m) => `ApexClass:${m[1]}`,
  },
  {
    regex: /<content>([^<]+)<\/content>/gi,
    resolve: (m, comp) => {
      if (comp.metadataType === 'ApexTrigger' || comp.metadataType === 'ApexClass') {
        return null;
      }
      return `ApexClass:${m[1]}`;
    },
  },
  {
    regex: /<controller>([^<]+)<\/controller>/gi,
    resolve: (m) => `ApexClass:${m[1]}`,
  },
  {
    regex: /<extends>([^<]+)<\/extends>/gi,
    resolve: (m) => `ApexClass:${m[1]}`,
  },
  {
    regex: /<lwc:component[^>]*>([^<]+)<\/lwc:component>/gi,
    resolve: (m) => `LightningComponentBundle:${m[1]}`,
  },
];

const APEX_REF = /\b([A-Z][a-zA-Z0-9_]*)\s*\./g;

export function applyXmlReferenceDiscovery(
  repo: MetadataRepository,
  components: ScannedComponent[],
  projectRoot: string,
): void {
  const apexNames = new Set(
    components.filter((c) => c.metadataType === 'ApexClass').map((c) => c.apiName),
  );
  const objectNames = new Set(
    components.filter((c) => c.metadataType === 'CustomObject').map((c) => c.apiName),
  );

  for (const comp of components) {
    if (!comp.filePath) continue;
    const abs = comp.filePath.startsWith('/')
      ? comp.filePath
      : `${projectRoot}/${comp.filePath}`;
    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    const fromId = `${comp.metadataType}:${comp.apiName}`;

    for (const { regex, resolve } of XML_REF_PATTERNS) {
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const target = resolve(m, comp);
        if (target && repo.hasNode(target)) {
          repo.addEdge(fromId, target, 'xml_parse');
        } else if (target) {
          const [type, name] = target.split(':');
          if (type && name) {
            repo.getOrCreate(type, name);
            repo.addEdge(fromId, `${type}:${name}`, 'xml_parse', 0.7);
          }
        }
      }
    }

    if (comp.metadataType === 'ApexClass' || comp.metadataType === 'ApexTrigger') {
      APEX_REF.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = APEX_REF.exec(content)) !== null) {
        const cls = m[1];
        if (apexNames.has(cls)) {
          repo.addEdge(fromId, `ApexClass:${cls}`, 'cross_ref');
        } else if (objectNames.has(cls)) {
          repo.addEdge(fromId, `CustomObject:${cls}`, 'cross_ref');
        }
      }
    }
  }
}
