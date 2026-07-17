import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  DEFAULT_AZURE_MANIFEST_PATH,
  normalizeGitSourceConfig,
  type AzureDeployConfig,
  type GitSourceConfig,
} from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { isIntelligentDeployEnabled } from '../intelligent-deploy/intelligent-orchestrator.service';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import { FreezeWindowService } from '../calendar/freeze-window.service';

export interface MetadataDeployEnqueueInput {
  orgAlias: string;
  gitSource?: GitSourceConfig;
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
  sourceArtifactId?: string;
  sourceOrgId?: string;
  sourceOrgAlias?: string;
  deployMode?: 'git' | 'azure' | 'org_to_org' | 'local_workspace';
  manifestContent?: string;
  intelligentDeployEnabled?: boolean;
  intelligentDeployRunId?: string;
  createdBy?: string;
  chainDataDeploy?: boolean;
  dataDeployConfig?: Array<Record<string, unknown>>;
  workbenchRunId?: string;
}

export class MetadataEnqueueError extends Error {
  constructor(
    cause: unknown,
    readonly sideEffectMayHavePersisted: boolean,
  ) {
    super(cause instanceof Error ? cause.message : 'Metadata deployment enqueue failed', {
      cause,
    });
    this.name = 'MetadataEnqueueError';
  }
}

const enqueuePersistence = Symbol('metadataEnqueuePersistence');

export function metadataEnqueueSideEffectMayHavePersisted(error: unknown): boolean | null {
  if (error instanceof MetadataEnqueueError) return error.sideEffectMayHavePersisted;
  if (error instanceof Error && enqueuePersistence in error) {
    return (error as Error & { [enqueuePersistence]: boolean })[enqueuePersistence];
  }
  return null;
}

function annotateEnqueueError(error: unknown, sideEffectMayHavePersisted: boolean): Error {
  if (!(error instanceof Error)) {
    return new MetadataEnqueueError(error, sideEffectMayHavePersisted);
  }
  Object.defineProperty(error, enqueuePersistence, {
    value: sideEffectMayHavePersisted,
    configurable: true,
  });
  return error;
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
    private readonly scmSources: ScmSourceService,
    private readonly freezeWindows: FreezeWindowService,
  ) {}

  async enqueue(input: MetadataDeployEnqueueInput) {
    // Freeze gate: every metadata deploy funnels through here (classic,
    // org-to-org, workbench, pipelines). Validation-only runs are allowed.
    await this.freezeWindows.assertDeployAllowed({
      orgAlias: input.orgAlias,
      validateOnly: input.validateOnly ?? false,
    });
    const dispatch = { started: false };
    try {
      return await this.enqueueInternal(input, dispatch);
    } catch (error) {
      throw annotateEnqueueError(error, dispatch.started);
    }
  }

  private async enqueueInternal(
    input: MetadataDeployEnqueueInput,
    dispatch: { started: boolean },
  ) {
    const normalized = normalizeGitSourceConfig({
      gitSource: input.gitSource,
      azureDeploy: input.azureDeploy,
    });
    const gitSource = normalized.gitSource
      ? await this.scmSources.requireActive(normalized.gitSource)
      : undefined;
    const manifestPath =
      gitSource?.manifestPath ??
      input.azureDeploy?.manifestPath ??
      process.env.SCM_DEFAULT_MANIFEST_PATH ??
      process.env.AZURE_DEFAULT_MANIFEST_PATH ??
      DEFAULT_AZURE_MANIFEST_PATH;

    const azureDeploy: AzureDeployConfig | undefined =
      gitSource?.provider === 'azure_devops'
        ? {
            project: gitSource.project ?? gitSource.namespace,
            repo: gitSource.repo,
            branch: gitSource.branch,
            manifestPath,
          }
        : undefined;

    const intelligentDeployEnabled =
      input.intelligentDeployEnabled ?? isIntelligentDeployEnabled();

    const jobPayload = {
      orgAlias: input.orgAlias,
      manifestPath,
      manifestContent: input.manifestContent,
      gitSource: gitSource ? { ...gitSource, manifestPath } : undefined,
      // Keep the Azure alias for old workers while canonical gitSource is authoritative.
      azureDeploy,
      testLevel: input.testLevel,
      tests: input.tests,
      validateOnly: input.validateOnly ?? false,
      destructiveChangesXml: input.destructiveChangesXml,
      quickDeployValidationId: input.quickDeployValidationId,
      localProjectRoot: input.localProjectRoot,
      sourceArtifactId: input.sourceArtifactId,
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
      workbenchRunId: input.workbenchRunId,
    };

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.METADATA_DEPLOY,
        type: input.workbenchRunId
          ? 'workbench_metadata_deploy'
          : input.automationRunId
            ? 'pipeline_metadata_deploy'
            : 'metadata_deploy',
        parentRunId: input.automationRunId ?? null,
        status: 'pending',
        currentStep: input.workbenchRunId
          ? 'Starting Deployment Workbench'
          : input.assignPermissionSetOnly
          ? 'Assign Permission Set'
          : input.quickDeployValidationId
            ? 'Quick deploy of validated changes'
            : input.validateOnly
              ? 'Validate-only deploy'
              : input.deployMode === 'org_to_org'
                ? 'Preparing org-to-org metadata deploy'
                : gitSource
                  ? `Connecting to ${gitSource.provider}`
                  : 'Preparing metadata deployment',
        createdBy: input.createdBy ?? 'system',
        payload: jobPayload as Prisma.InputJsonValue,
      },
    });

    dispatch.started = true;
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
        repo: gitSource?.repo,
        branch: gitSource?.branch,
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
            deployMode: input.deployMode ?? (gitSource ? 'git' : 'azure'),
            provider: gitSource?.provider,
            connectionId: gitSource?.connectionId,
            bindingId: gitSource?.bindingId,
            gitSource,
            intelligentDeployRunId: input.intelligentDeployRunId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return job;
  }
}
