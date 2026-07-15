import * as fs from 'node:fs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  buildDestructiveChangesXml,
  deployNowSchema,
  deploymentSchema,
  gitSourceConfigSchema,
  orgToOrgMetadataDeploySchema,
  resolveManifestXml,
  type GitSourceConfig,
  type ScmProvider,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { AzureService } from '../../integrations/azure/azure.service';
import { JenkinsService } from '../../integrations/jenkins/jenkins.service';
import {
  MetadataDeployQueueService,
  metadataEnqueueSideEffectMayHavePersisted,
} from './metadata-deploy-queue.service';
import { MetadataDeployJobService } from './metadata-deploy-job.service';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { StreamService } from '../stream/stream.service';
import { QUEUE_NAMES } from '@sfcc/shared';
import { assertOrgOwned, assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';
import { ScmAdapterRegistry } from '../../integrations/foundation/adapter.registry';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import { DeploymentArtifactStore } from './deployment-artifact.store';

@Injectable()
export class DeploymentService {
  constructor(
    private readonly azureService: AzureService,
    private readonly scmAdapters: ScmAdapterRegistry,
    private readonly scmSources: ScmSourceService,
    private readonly jenkinsService: JenkinsService,
    private readonly metadataDeployQueue: MetadataDeployQueueService,
    private readonly metadataDeployJobService: MetadataDeployJobService,
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly streamService: StreamService,
    private readonly artifactStore: DeploymentArtifactStore = new DeploymentArtifactStore(),
  ) {}

  async listDeployments(userId: string) {
    const deployments = await prisma.deployment.findMany({
      where: userOwnedWhere(userId),
      include: {
        targetOrg: true,
        rollbacks: true,
        job: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            error: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sourceIds = [...new Set(deployments.map((d) => d.sourceOrgId).filter(Boolean))] as string[];
    const sourceOrgs = sourceIds.length
      ? await prisma.orgConnection.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, alias: true, username: true },
        })
      : [];
    const sourceMap = new Map(sourceOrgs.map((o) => [o.id, o]));

    return deployments.map((d) => ({
      ...d,
      provider:
        ((d.metadata as Record<string, unknown> | null)?.provider as string | undefined) ??
        (d.strategy === 'azure' ? 'azure_devops' : d.strategy),
      sourceOrg: d.sourceOrgId ? sourceMap.get(d.sourceOrgId) ?? null : null,
    }));
  }

  async createDeployment(body: unknown, userId: string) {
    const input = deploymentSchema.parse(body);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    const gitSource = input.gitSource
      ? await this.scmSources.resolve(input.gitSource)
      : undefined;
    return prisma.deployment.create({
      data: {
        targetOrgId: input.targetOrgId,
        sourceOrgId: input.sourceOrgId,
        repo: input.repo,
        branch: input.branch,
        strategy: input.strategy,
        status: 'pending',
        metadata: gitSource
          ? {
              provider: gitSource.provider,
              connectionId: gitSource.connectionId,
              bindingId: gitSource.bindingId,
              manifestPath: gitSource.manifestPath,
              gitSource,
            } as Prisma.InputJsonValue
          : undefined,
        createdBy: userId,
      },
    });
  }

  async deployNow(body: unknown, userId: string) {
    const input = deployNowSchema.parse(body);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    const target = await prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } });
    if (!target) throw new NotFoundException('Target org not found');

    let sourceOrgAlias: string | undefined;
    if (input.sourceOrgId) {
      await assertOrgOwned(input.sourceOrgId, userId, prisma);
      const sourceOrg = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
      if (!sourceOrg) throw new NotFoundException('Source org not found');
      sourceOrgAlias = sourceOrg.username ?? sourceOrg.alias;
    }

    const gitSource = await this.scmSources.requireActive(input.gitSource!);

    const deployMode = input.sourceOrgId ? 'org_to_org' as const : 'git' as const;

    const deployment = await prisma.deployment.create({
      data: {
        targetOrgId: input.targetOrgId,
        sourceOrgId: input.sourceOrgId,
        repo: input.repo,
        branch: input.branch,
        strategy: 'azure',
        status: 'running',
        metadata: {
          manifestPath: input.manifestPath,
          provider: gitSource.provider,
          connectionId: gitSource.connectionId,
          bindingId: gitSource.bindingId,
          gitSource,
          deployMode,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
      include: { targetOrg: true },
    });

    const job = await this.metadataDeployQueue.enqueue({
      deploymentId: deployment.id,
      orgAlias: target.username ?? target.alias,
      testLevel: input.testLevel,
      sourceOrgId: input.sourceOrgId,
      sourceOrgAlias,
      deployMode,
      gitSource,
    });

    const updated = await prisma.deployment.findUnique({
      where: { id: deployment.id },
      include: {
        targetOrg: true,
        job: { select: { id: true, status: true, currentStep: true } },
      },
    });

    return {
      deploymentId: deployment.id,
      jobId: job.id,
      status: updated?.status ?? 'running',
      deployment: updated,
    };
  }

  async deployOrgToOrgMetadata(
    body: unknown,
    userId: string,
    options?: { automationRunId?: string; deploymentId?: string },
  ) {
    const raw = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    const input = orgToOrgMetadataDeploySchema.parse({
      ...raw,
      automationRunId: options?.automationRunId ?? raw.automationRunId,
    });

    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);

    const [source, target] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } }),
    ]);
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    const packageXml = resolveManifestXml({
      selections: input.selections,
      packageXml: input.packageXml,
      apiVersion: input.apiVersion,
    });

    const destructiveChangesXml = input.destructiveSelections?.length
      ? buildDestructiveChangesXml(input.destructiveSelections, input.apiVersion)
      : undefined;

    const automationRunId = options?.automationRunId ?? (raw.automationRunId as string | undefined);

    const deploymentMetadata = {
      deployMode: 'org_to_org',
      selections: input.selections,
      validateOnly: input.validateOnly ?? false,
      tests: input.tests,
      destructiveSelections: input.destructiveSelections,
      chainDataDeploy: input.chainDataDeploy,
      dataDeployConfig: input.dataDeployConfig,
      automationRunId,
      comparisonId: input.comparisonId,
      deploymentName: input.deploymentName,
      deploymentNotes: input.deploymentNotes,
    };
    const existingDeployment = options?.deploymentId
      ? await prisma.deployment.findUnique({ where: { id: options.deploymentId } })
      : null;
    if (
      options?.deploymentId &&
      (!existingDeployment ||
        existingDeployment.createdBy !== userId ||
        existingDeployment.sourceOrgId !== input.sourceOrgId ||
        existingDeployment.targetOrgId !== input.targetOrgId)
    ) {
      throw new NotFoundException('Existing deployment for resume not found');
    }
    const deployment = existingDeployment
      ? await prisma.deployment.update({
          where: { id: existingDeployment.id },
          data: {
            status: 'running',
            metadata: {
              ...((existingDeployment.metadata as Record<string, unknown> | null) ?? {}),
              ...deploymentMetadata,
            } as Prisma.InputJsonValue,
          },
          include: { targetOrg: true },
        })
      : await prisma.deployment.create({
          data: {
            targetOrgId: input.targetOrgId,
            sourceOrgId: input.sourceOrgId,
            repo: 'org-to-org',
            branch: 'metadata',
            strategy: 'azure',
            status: 'running',
            metadata: deploymentMetadata as Prisma.InputJsonValue,
            createdBy: userId,
          },
          include: { targetOrg: true },
        });

    if (automationRunId) {
      const run = await prisma.automationRun.findUnique({
        where: { id: automationRunId },
        select: { checkpoint: true },
      });
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: {
          checkpoint: {
            ...((run?.checkpoint as Record<string, unknown> | null) ?? {}),
            deploymentId: deployment.id,
          } as Prisma.InputJsonValue,
        },
      });
    }

    const job = await this.metadataDeployQueue.enqueue({
      deploymentId: deployment.id,
      orgAlias: target.username ?? target.alias,
      testLevel: input.testLevel,
      tests: input.tests,
      validateOnly: input.validateOnly,
      destructiveChangesXml,
      sourceOrgId: input.sourceOrgId,
      sourceOrgAlias: source.username ?? source.alias,
      deployMode: 'org_to_org',
      manifestContent: packageXml,
      automationRunId,
      createdBy: userId,
      chainDataDeploy: input.chainDataDeploy,
      dataDeployConfig: input.dataDeployConfig,
      intelligentDeployEnabled: input.intelligentDeployEnabled ?? false,
    });

    const updated = await prisma.deployment.findUnique({
      where: { id: deployment.id },
      include: {
        targetOrg: true,
        job: { select: { id: true, status: true, currentStep: true } },
      },
    });

    return {
      deploymentId: deployment.id,
      jobId: job.id,
      status: updated?.status ?? 'running',
      deployment: updated,
    };
  }

  async approveDeployment(id: string, userId: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { targetOrg: true },
    });
    assertResourceOwner(deployment, userId, 'Deployment');
    const dep = deployment!;

    const storedSource = dep.strategy === 'azure'
      ? (() => {
          const metadata = (dep.metadata ?? {}) as Record<string, unknown>;
          return metadata.gitSource
            ? gitSourceConfigSchema.parse(metadata.gitSource)
            : {
                provider: 'azure_devops' as const,
                project: typeof metadata.project === 'string' ? metadata.project : undefined,
                repo: dep.repo,
                branch: dep.branch,
                manifestPath:
                  typeof metadata.manifestPath === 'string' ? metadata.manifestPath : undefined,
              };
        })()
      : null;
    const approvedAt = new Date();
    await prisma.deployment.update({
      where: { id },
      data: { approvedBy: userId, approvedAt, status: 'queued' },
    });

    try {
      if (dep.strategy === 'azure') {
        await this.metadataDeployQueue.enqueue({
          deploymentId: dep.id,
          orgAlias: dep.targetOrg.username ?? dep.targetOrg.alias,
          gitSource: storedSource!,
          createdBy: userId,
        });
      } else {
        await this.jenkinsService.triggerBuild(dep.repo, dep.branch);
      }
    } catch (error) {
      const safeToCompensate =
        metadataEnqueueSideEffectMayHavePersisted(error) === false;
      if (safeToCompensate) {
        await prisma.deployment.updateMany({
          where: {
            id,
            status: 'queued',
            approvedBy: userId,
            approvedAt,
          },
          data: {
            status: dep.status,
            approvedBy: dep.approvedBy,
            approvedAt: dep.approvedAt,
          },
        }).catch(() => undefined);
      }
      throw error;
    }

    return prisma.deployment.findUnique({
      where: { id },
      include: { targetOrg: true },
    });
  }

  async cancelDeployment(id: string, userId: string) {
    const deployment = await prisma.deployment.findUnique({ where: { id } });
    assertResourceOwner(deployment, userId, 'Deployment');
    if (!deployment.jobId) throw new NotFoundException('No active job for this deployment');

    const job = await prisma.job.findUnique({ where: { id: deployment.jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (!['pending', 'queued', 'running'].includes(job.status)) {
      return { cancelled: false, reason: 'Job is not active' };
    }

    await this.queueService.removeJob(QUEUE_NAMES.METADATA_DEPLOY, deployment.jobId).catch(() => false);
    // Kill the running `sf project deploy` process (locally and across cluster instances).
    this.metadataDeployJobService.cancel(deployment.jobId);
    await this.processRegistry.cancel(deployment.jobId);
    await this.jobsService.updateStatus(deployment.jobId, 'cancelled');
    await this.jobsService.addLog(deployment.jobId, 'stderr', 'Deployment cancelled by user');
    await this.streamService.publish('job_status', { jobId: deployment.jobId, status: 'cancelled' });

    await prisma.deployment.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return { cancelled: true, deploymentId: id, jobId: deployment.jobId };
  }

  /**
   * Real rollback: redeploy the pre-deploy snapshot that was retrieved from
   * the target org before the original deploy ran.
   */
  async rollback(
    id: string,
    reason: string,
    userId: string,
    testPolicy?: { testLevel: string; tests?: string[] },
  ) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { targetOrg: true },
    });
    assertResourceOwner(deployment, userId, 'Deployment');
    const dep = deployment!;

    const durableSnapshot = dep.snapshotPath?.startsWith('deployment-snapshot:')
      ? dep.snapshotPath
      : undefined;
    if (durableSnapshot) {
      await this.artifactStore.readBytes(durableSnapshot).catch(() => {
        throw new BadRequestException('The durable rollback snapshot failed checksum verification');
      });
    }
    if (!dep.snapshotPath || (!durableSnapshot && !fs.existsSync(dep.snapshotPath))) {
      throw new BadRequestException(
        'No pre-deploy snapshot exists for this deployment — rollback is not available',
      );
    }

    const rollback = await prisma.rollback.create({
      data: { deploymentId: id, reason, status: 'queued' },
    });

    const rollbackDeployment = await prisma.deployment.create({
      data: {
        targetOrgId: dep.targetOrgId,
        sourceOrgId: dep.sourceOrgId,
        repo: 'rollback',
        branch: 'snapshot',
        strategy: 'azure',
        status: 'queued',
        metadata: {
          deployMode: 'local_workspace',
          rollbackOfDeploymentId: id,
          rollbackId: rollback.id,
          reason,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });

    const job = await this.metadataDeployQueue.enqueue({
      deploymentId: rollbackDeployment.id,
      orgAlias: dep.targetOrg.username ?? dep.targetOrg.alias,
      deployMode: 'local_workspace',
      localProjectRoot: durableSnapshot ? undefined : dep.snapshotPath,
      sourceArtifactId: durableSnapshot,
      testLevel: testPolicy?.testLevel ?? 'NoTestRun',
      tests: testPolicy?.tests,
      createdBy: userId,
      intelligentDeployEnabled: false,
    });

    await prisma.rollback.update({
      where: { id: rollback.id },
      data: { status: 'running' },
    });

    await prisma.deploymentAudit.create({
      data: {
        deploymentId: id,
        action: 'rollback_enqueued',
        targetOrgId: dep.targetOrgId,
        status: 'queued',
        performedBy: userId,
      },
    }).catch(() => undefined);

    return {
      rollbackId: rollback.id,
      deploymentId: rollbackDeployment.id,
      jobId: job.id,
      status: 'queued',
    };
  }

  /** Quick deploy a previously validated (check-only) deployment. */
  async quickDeploy(id: string, userId: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { targetOrg: true },
    });
    assertResourceOwner(deployment, userId, 'Deployment');
    const dep = deployment!;

    if (!dep.validationId) {
      throw new BadRequestException(
        'This deployment has no validation id — run a validate-only deploy first',
      );
    }

    const job = await this.metadataDeployQueue.enqueue({
      deploymentId: dep.id,
      orgAlias: dep.targetOrg.username ?? dep.targetOrg.alias,
      quickDeployValidationId: dep.validationId,
      createdBy: userId,
      intelligentDeployEnabled: false,
    });

    await prisma.deployment.update({
      where: { id },
      data: { status: 'queued' },
    });

    return { deploymentId: id, jobId: job.id, validationId: dep.validationId, status: 'queued' };
  }

  /** Apex class list for the RunSpecifiedTests test-class picker. */
  async listApexTestClasses(orgId: string, userId: string, search?: string) {
    const org = await assertOrgOwned(orgId, userId, prisma);
    const alias = org.username ?? org.alias;
    const sfCli = createSfCliClient();
    const result = await sfCli.query(
      alias,
      "SELECT Name FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name LIMIT 2000",
    );
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Could not list Apex classes');
    }
    const records = (result.data?.result?.records ?? []) as Array<{ Name?: string }>;
    let classes = records
      .map((r) => r.Name)
      .filter((n): n is string => Boolean(n))
      .map((name) => ({ name, likelyTest: /test/i.test(name) }));
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      classes = classes.filter((c) => c.name.toLowerCase().includes(q));
    }
    return {
      orgId,
      classes: classes.sort((a, b) => Number(b.likelyTest) - Number(a.likelyTest) || a.name.localeCompare(b.name)),
    };
  }

  async listRepos(
    providerOrStrategy: ScmProvider | 'azure' | 'jenkins',
    connectionId?: string,
    namespace?: string,
    project?: string,
  ) {
    if (providerOrStrategy === 'jenkins') return this.jenkinsService.listJobs();
    const provider = providerOrStrategy === 'azure' ? 'azure_devops' : providerOrStrategy;
    return this.scmAdapters.get(provider).listRepositories({ connectionId, namespace, project });
  }

  async listBranches(
    providerOrStrategy: ScmProvider | 'azure' | 'jenkins',
    repo: string,
    project?: string,
    connectionId?: string,
    namespace?: string,
    repositoryId?: string,
    bindingId?: string,
  ) {
    if (providerOrStrategy === 'jenkins') {
      return this.jenkinsService.listBranches(repo);
    }
    const provider = providerOrStrategy === 'azure' ? 'azure_devops' : providerOrStrategy;
    const source: GitSourceConfig = {
      provider,
      connectionId,
      namespace,
      project,
      repositoryId,
      bindingId,
      repo,
      branch: 'main',
    };
    const resolved = await this.scmSources.resolve(source);
    return this.scmAdapters.get(provider).listBranches(resolved);
  }

  getScmDefaults(provider: ScmProvider, connectionId?: string) {
    return this.scmAdapters.get(provider).getConnectionStatus({ connectionId });
  }

  getAzureDefaults() {
    return this.azureService.getDefaults();
  }
}
