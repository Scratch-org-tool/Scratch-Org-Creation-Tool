'use client';

import { InlineAlert, PageSkeleton } from '@/components/studio';
import { useAzureDeploy } from './azure/use-azure-deploy';
import { AzurePageHeader } from './azure/azure-page-header';
import { AzureDeploymentStats } from './azure/azure-deployment-stats';
import { AzureDeploymentForm, DEPLOY_CARD_HEIGHT } from './azure/azure-deployment-form';
import { AzureLiveConsole } from './azure/azure-live-console';
import { AzureRecentDeployments } from './azure/azure-recent-deployments';

export function AzureDeployWorkspace() {
  const d = useAzureDeploy();
  const showDataSkeleton = d.loading;

  const hasActiveJob = !!(d.jobId || d.logs.length);

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-0">
      <AzurePageHeader azureStatus={d.azureStatus} project={d.form.project} />

      {d.deployError && (
        <InlineAlert variant="error" onDismiss={() => d.setDeployError(null)}>
          {d.deployError}
        </InlineAlert>
      )}

      {showDataSkeleton ? (
        <PageSkeleton variant="studio-2row" />
      ) : (
        <>
      <AzureDeploymentStats
        history={d.history}
        activeOrgAlias={d.isRunning ? d.targetOrgAlias : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-2 items-stretch">
        <AzureDeploymentForm
          form={d.form}
          setForm={d.setForm}
          orgs={d.orgs}
          repos={d.repos}
          branches={d.branches}
          azureStatus={d.azureStatus}
          targetOrgAlias={d.targetOrgAlias}
          isRunning={d.isRunning}
          canDeploy={d.canDeploy}
          deploying={d.deploying}
          onRepoChange={d.onRepoChange}
          onDeploy={d.deploy}
        />

        <div
          className="sticky top-6 z-10 min-w-0 h-[var(--deploy-card-height)] max-h-[var(--deploy-card-height)]"
          style={{ '--deploy-card-height': DEPLOY_CARD_HEIGHT } as React.CSSProperties}
        >
          <AzureLiveConsole
            className="h-full"
            jobStatus={d.jobStatus}
            currentStep={d.currentStep}
            logs={d.logs}
            logStreams={d.logStreams}
            sseConnected={d.sseConnected}
            hasActiveJob={hasActiveJob}
            logsTruncated={d.logsTruncated}
            logCount={d.logCount}
            loadingLogs={!!d.selectingDeploymentId}
            deployStartedAt={d.deployStartedAt}
            stopping={d.stopping}
            onCancel={d.cancelDeploy}
          />
        </div>
      </div>

      <AzureRecentDeployments
        history={d.history}
        activeDeploymentId={d.activeDeploymentId}
        selectingDeploymentId={d.selectingDeploymentId}
        onSelect={d.selectHistory}
      />
        </>
      )}
    </div>
  );
}
