import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { QUEUE_NAMES, DEFAULT_AZURE_MANIFEST_PATH, type AzureDeployConfig } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { AzureService } from '../../integrations/azure/azure.service';
import { isIntelligentDeployEnabled } from '../intelligent-deploy/intelligent-orchestrator.service';

export interface MetadataDeployEnqueueInput {
  orgAlias: string;
  azureDeploy?: AzureDeployConfig;
  deploymentId?: string;
  automationRunId?: string;
  assignPermissionSet?: boolean;
  assignPermissionSetOnly?: boolean;
  testLevel?: string;
  tests?: string[];
  validateOnly?: boolean;
  destructiveChangesXml?: string;
  quickDeployValidationId?: string;
  localProjectRoot?: string;
  sourceOrgId?: string;
  sourceOrgAlias?: string;
  deployMode?: 'azure' | 'org_to_org' | 'local_workspace';
  manifestContent?: string;
  intelligentDeployEnabled?: boolean;
  intelligentDeployRunId?: string;
  createdBy?: string;
  chainDataDeploy?: boolean;
  dataDeployConfig?: Array<Record<string, unknown>>;
}

function manifestHash(content?: string): string | undefined {
  if (!content?.trim()) return undefined;
  return createHash('sha256').update(content).digest('hex');
}

function countManifestMembers(content?: string): number | undefined {
  if (!content?.trim()) return undefined;
  return content.match(/<members>/gi)?.length ?? 0;
}

@Injectable()
export class MetadataDeployQueueService {
  constructor(
    private readonly queueService: QueueService,
    private readonly azureService: AzureService,
  ) {}

  async resolveAzureProject(repo: string, projectHint?: string): Promise<string> {
    if (projectHint?.trim()) return projectHint.trim();
    const repos = await this.azureService.listRepos();
    const match = repos.find((r) => r.name === repo);
    if (match?.project) return match.project;
    const defaults = this.azureService.getDefaults();
    return defaults.project;
  }

  async enqueue(input: MetadataDeployEnqueueInput) {
    const manifestPath =
      input.azureDeploy?.manifestPath ??
      process.env.AZURE_DEFAULT_MANIFEST_PATH ??
      DEFAULT_AZURE_MANIFEST_PATH;

    let azureDeploy: AzureDeployConfig | undefined = input.azureDeploy;
    if (azureDeploy?.repo) {
      const project = await this.resolveAzureProject(azureDeploy.repo, azureDeploy.project);
      azureDeploy = {
        ...azureDeploy,
        project: project || azureDeploy.project,
        manifestPath,
      };
    }

    const intelligentDeployEnabled =
      input.intelligentDeployEnabled ?? isIntelligentDeployEnabled();

    const jobPayload = {
      orgAlias: input.orgAlias,
      manifestPath,
      manifestContent: input.manifestContent,
      azureDeploy,
      testLevel: input.testLevel,
      tests: input.tests,
      validateOnly: input.validateOnly ?? false,
      destructiveChangesXml: input.destructiveChangesXml,
      quickDeployValidationId: input.quickDeployValidationId,
      localProjectRoot: input.localProjectRoot,
      automationRunId: input.automationRunId,
      deploymentId: input.deploymentId,
      assignPermissionSet: input.assignPermissionSet ?? false,
      assignPermissionSetOnly: input.assignPermissionSetOnly ?? false,
      sourceOrgId: input.sourceOrgId,
      sourceOrgAlias: input.sourceOrgAlias,
      deployMode: input.deployMode,
      intelligentDeployEnabled,
      intelligentDeployRunId: input.intelligentDeployRunId,
      chainDataDeploy: input.chainDataDeploy,
      dataDeployConfig: input.dataDeployConfig,
    };

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.METADATA_DEPLOY,
        type: input.automationRunId ? 'pipeline_metadata_deploy' : 'metadata_deploy',
        parentRunId: input.automationRunId ?? null,
        status: 'pending',
        currentStep: input.assignPermissionSetOnly
          ? 'Assign Permission Set'
          : input.quickDeployValidationId
            ? 'Quick deploy of validated changes'
            : input.validateOnly
              ? 'Validate-only deploy'
              : input.deployMode === 'org_to_org'
                ? 'Preparing org-to-org metadata deploy'
                : 'Connecting to Azure DevOps',
        createdBy: input.createdBy ?? 'system',
        payload: jobPayload as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.METADATA_DEPLOY,
      job.type,
      { ...jobPayload, dbJobId: job.id },
      job.id,
    );

    // Immutable audit trail — one row per action, never mutated afterwards.
    await prisma.deploymentAudit.create({
      data: {
        deploymentId: input.deploymentId,
        action: input.quickDeployValidationId
          ? 'quick_deploy_enqueued'
          : input.validateOnly
            ? 'validation_enqueued'
            : 'deploy_enqueued',
        sourceOrgId: input.sourceOrgId,
        targetOrgId: undefined,
        repo: azureDeploy?.repo,
        branch: azureDeploy?.branch,
        manifestHash: manifestHash(input.manifestContent),
        componentCount: countManifestMembers(input.manifestContent),
        testLevel: input.testLevel,
        validationId: input.quickDeployValidationId,
        status: 'queued',
        performedBy: input.createdBy ?? 'system',
      },
    }).catch(() => undefined);

    if (input.deploymentId) {
      const existing = await prisma.deployment.findUnique({
        where: { id: input.deploymentId },
        select: { status: true, metadata: true },
      });
      const meta = (existing?.metadata ?? {}) as Record<string, unknown>;
      await prisma.deployment.update({
        where: { id: input.deploymentId },
        data: {
          jobId: job.id,
          status: existing?.status === 'running' ? 'running' : 'queued',
          metadata: {
            ...meta,
            intelligentDeployEnabled,
            deployMode: input.deployMode ?? 'azure',
            intelligentDeployRunId: input.intelligentDeployRunId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return job;
  }
}
