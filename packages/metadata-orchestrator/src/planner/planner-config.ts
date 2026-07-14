export interface PlannerConfig {
  maxBatchSize: number;
  maxBatchWeight: number;
  minBatchSize: number;
  weightByType: Record<string, number>;
  estimatedMsPerComponent: number;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxBatchSize: 50,
  maxBatchWeight: 200,
  minBatchSize: 1,
  weightByType: {
    Profile: 5,
    PermissionSet: 3,
    Flow: 3,
    CustomObject: 2,
    ApexClass: 2,
    LightningComponentBundle: 2,
  },
  estimatedMsPerComponent: 3000,
};

export function componentWeight(metadataType: string, config: PlannerConfig): number {
  return config.weightByType[metadataType] ?? 1;
}
