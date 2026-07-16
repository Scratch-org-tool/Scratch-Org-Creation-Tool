'use client';

import { DeploymentWorkbenchWorkspace } from '@/modules/deployment-workbench/deployment-workbench-workspace';

export default function MetadataDeploymentPage() {
  return <DeploymentWorkbenchWorkspace sourceMode="org_compare" />;
}
