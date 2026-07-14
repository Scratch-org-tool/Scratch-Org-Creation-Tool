import type { MetadataRepository } from '../repository/metadata-repository';
import type { ScannedComponent } from '../scanner/source-scanner';

export interface DependencyRule {
  metadataType: string;
  dependsOnTypes: string[];
  /** field on same object e.g. CustomField -> CustomObject */
  sameObjectParent?: boolean;
}

export const KNOWN_DEPENDENCY_RULES: DependencyRule[] = [
  { metadataType: 'CustomField', dependsOnTypes: ['CustomObject'], sameObjectParent: true },
  { metadataType: 'RecordType', dependsOnTypes: ['CustomObject'], sameObjectParent: true },
  { metadataType: 'ValidationRule', dependsOnTypes: ['CustomObject'], sameObjectParent: true },
  { metadataType: 'BusinessProcess', dependsOnTypes: ['CustomObject'], sameObjectParent: true },
  { metadataType: 'ApexTrigger', dependsOnTypes: ['CustomObject'] },
  { metadataType: 'Layout', dependsOnTypes: ['CustomObject'] },
  { metadataType: 'FlexiPage', dependsOnTypes: ['CustomObject', 'ApexClass', 'LightningComponentBundle'] },
  { metadataType: 'PermissionSet', dependsOnTypes: ['CustomObject', 'ApexClass', 'Flow'] },
  { metadataType: 'Profile', dependsOnTypes: ['CustomObject', 'ApexClass'] },
  { metadataType: 'Flow', dependsOnTypes: ['CustomObject', 'ApexClass'] },
  { metadataType: 'LightningComponentBundle', dependsOnTypes: ['ApexClass', 'CustomObject'] },
  { metadataType: 'AuraDefinitionBundle', dependsOnTypes: ['ApexClass'] },
];

export function applyKnownRules(
  repo: MetadataRepository,
  components: ScannedComponent[],
): void {
  const byType = new Map<string, ScannedComponent[]>();
  for (const c of components) {
    const list = byType.get(c.metadataType) ?? [];
    list.push(c);
    byType.set(c.metadataType, list);
  }

  for (const comp of components) {
    repo.getOrCreate(comp.metadataType, comp.apiName, { filePath: comp.filePath });
  }

  for (const comp of components) {
    const rules = KNOWN_DEPENDENCY_RULES.filter((r) => r.metadataType === comp.metadataType);
    for (const rule of rules) {
      for (const depType of rule.dependsOnTypes) {
        const candidates = byType.get(depType) ?? [];
        for (const dep of candidates) {
          if (rule.sameObjectParent) {
            const parentName = comp.apiName.split('.')[0];
            if (dep.apiName !== parentName && !comp.apiName.startsWith(`${dep.apiName}.`)) continue;
          }
          const fromId = `${comp.metadataType}:${comp.apiName}`;
          const toId = `${dep.metadataType}:${dep.apiName}`;
          repo.addEdge(fromId, toId, 'known_rule');
        }
      }
    }

    if (comp.metadataType === 'CustomField' || comp.metadataType === 'ValidationRule') {
      const objectName = comp.apiName.split('.')[0];
      if (objectName) {
        repo.addEdge(
          `${comp.metadataType}:${comp.apiName}`,
          `CustomObject:${objectName}`,
          'known_rule',
        );
      }
    }
  }
}

/** Greenfield-only rules for empty scratch org deploys */
export function applyGreenfieldRules(
  repo: MetadataRepository,
  components: ScannedComponent[],
): void {
  const objectNames = new Set(
    components.filter((c) => c.metadataType === 'CustomObject').map((c) => c.apiName),
  );

  for (const comp of components) {
    if (comp.metadataType !== 'ApexTrigger') continue;
    const fromId = `ApexTrigger:${comp.apiName}`;

    // Filename convention: AccountTrigger -> Account, MyObjTrigger -> MyObj__c
    const baseName = comp.apiName.replace(/Trigger$/i, '');
    if (objectNames.has(baseName)) {
      repo.addEdge(fromId, `CustomObject:${baseName}`, 'known_rule');
    }
    const withSuffix = baseName.endsWith('__c') ? baseName : `${baseName}__c`;
    if (withSuffix !== baseName && objectNames.has(withSuffix)) {
      repo.addEdge(fromId, `CustomObject:${withSuffix}`, 'known_rule');
    }
  }
}
