import type { DeployError, DependencySource, DeploymentState } from './deployment-state';

export type MetadataType = string;

export function metadataNodeId(metadataType: string, apiName: string): string {
  return `${metadataType}:${apiName}`;
}

export function parseMetadataNodeId(id: string): { metadataType: string; apiName: string } {
  const idx = id.indexOf(':');
  if (idx < 0) return { metadataType: 'Unknown', apiName: id };
  return {
    metadataType: id.slice(0, idx),
    apiName: id.slice(idx + 1),
  };
}

export interface MetadataNode {
  id: string;
  metadataType: MetadataType;
  apiName: string;
  filePath: string | null;
  dependencies: Set<string>;
  dependents: Set<string>;
  indegree: number;
  outdegree: number;
  deploymentState: DeploymentState;
  batchNumber: number | null;
  deploymentDurationMs: number | null;
  retryCount: number;
  priority: number;
  lastError: DeployError | null;
  discoveredBy: DependencySource[];
  requiresSourceExpansion?: boolean;
}

export function createMetadataNode(
  metadataType: string,
  apiName: string,
  overrides?: Partial<Pick<MetadataNode, 'filePath' | 'deploymentState' | 'requiresSourceExpansion'>>,
): MetadataNode {
  const id = metadataNodeId(metadataType, apiName);
  return {
    id,
    metadataType,
    apiName,
    filePath: overrides?.filePath ?? null,
    dependencies: new Set(),
    dependents: new Set(),
    indegree: 0,
    outdegree: 0,
    deploymentState: overrides?.deploymentState ?? 'DISCOVERED',
    batchNumber: null,
    deploymentDurationMs: null,
    retryCount: 0,
    priority: defaultPriority(metadataType),
    lastError: null,
    discoveredBy: [],
    requiresSourceExpansion: overrides?.requiresSourceExpansion,
  };
}

/** Lower number = deploy earlier among equals */
export function defaultPriority(metadataType: string): number {
  const order: Record<string, number> = {
    CustomObject: 10,
    CustomField: 20,
    RecordType: 25,
    BusinessProcess: 26,
    ValidationRule: 30,
    ApexClass: 40,
    ApexTrigger: 45,
    LightningComponentBundle: 50,
    FlexiPage: 55,
    Layout: 60,
    Flow: 65,
    PermissionSet: 80,
    Profile: 90,
  };
  return order[metadataType] ?? 50;
}
