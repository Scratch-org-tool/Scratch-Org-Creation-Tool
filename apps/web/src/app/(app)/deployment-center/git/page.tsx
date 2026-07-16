'use client';

import { DeploymentWorkbenchWorkspace } from '@/modules/deployment-workbench/deployment-workbench-workspace';

export default function GitMetadataDeploymentPage() {
  return <DeploymentWorkbenchWorkspace sourceMode="scm" />;
}
