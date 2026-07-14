import * as fs from 'node:fs';
import type { MetadataRepository } from '../repository/metadata-repository';
import type { ScannedComponent } from '../scanner/source-scanner';

const SOQL_FROM = /\bFROM\s+([A-Za-z][A-Za-z0-9_]*__c)\b/gi;
const SCHEMA_OBJECT = /\bSchema\.SObjectType\.([A-Za-z][A-Za-z0-9_]*__c)\b/g;
const NEW_INSTANCE = /\bnew\s+([A-Za-z][A-Za-z0-9_]*__c)\s*\(/g;
const LIST_TYPE = /\bList\s*<\s*([A-Za-z][A-Za-z0-9_]*__c)\s*>/g;
const FIELD_TOKEN = /\b([A-Za-z][A-Za-z0-9_]*__c)\.([A-Za-z][A-Za-z0-9_]*__c)\b/g;

function addObjectEdge(repo: MetadataRepository, fromId: string, objectName: string): void {
  const toId = `CustomObject:${objectName}`;
  if (repo.hasNode(toId)) {
    repo.addEdge(fromId, toId, 'cross_ref');
  } else {
    repo.getOrCreate('CustomObject', objectName);
    repo.addEdge(fromId, toId, 'cross_ref', 0.8);
  }
}

function addFieldEdge(repo: MetadataRepository, fromId: string, objectName: string, fieldName: string): void {
  const fieldId = `CustomField:${objectName}.${fieldName}`;
  addObjectEdge(repo, fromId, objectName);
  if (repo.hasNode(fieldId)) {
    repo.addEdge(fromId, fieldId, 'cross_ref');
  } else {
    repo.getOrCreate('CustomField', `${objectName}.${fieldName}`);
    repo.addEdge(fromId, fieldId, 'cross_ref', 0.75);
  }
}

function scanPattern(
  content: string,
  regex: RegExp,
  onMatch: (match: RegExpExecArray) => void,
): void {
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    onMatch(m);
  }
}

export function applyApexReferenceDiscovery(
  repo: MetadataRepository,
  components: ScannedComponent[],
  projectRoot: string,
): void {
  const apexComponents = components.filter(
    (c) => c.metadataType === 'ApexClass' || c.metadataType === 'ApexTrigger',
  );

  for (const comp of apexComponents) {
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

    scanPattern(content, SOQL_FROM, (m) => addObjectEdge(repo, fromId, m[1]));
    scanPattern(content, SCHEMA_OBJECT, (m) => addObjectEdge(repo, fromId, m[1]));
    scanPattern(content, NEW_INSTANCE, (m) => addObjectEdge(repo, fromId, m[1]));
    scanPattern(content, LIST_TYPE, (m) => addObjectEdge(repo, fromId, m[1]));
    scanPattern(content, FIELD_TOKEN, (m) => addFieldEdge(repo, fromId, m[1], m[2]));
  }
}
