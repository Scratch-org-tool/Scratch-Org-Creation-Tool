import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  scratchOrgCreateSchema,
  scratchOrgSkipStepSchema,
  type GitSourceConfig,
  type ScmProvider,
  type ScratchOrgCreateConfig,
  type ScratchOrgSkipStepKey,
} from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { StreamService } from '../stream/stream.service';
import { ScratchOrgJobService } from './scratch-org-job.service';
import { PipelineOrchestratorService } from '../orchestrator/pipeline-orchestrator.service';
import { OrgsService } from '../orgs/orgs.service';
import { DataDeployOrchestratorService } from '../data/data-deploy-orchestrator.service';
import { AzureService } from '../../integrations/azure/azure.service';
import { AzureIntegrationService } from '../integrations/azure-integration.service';
import { OrgConfigLoaderService } from './org-config-loader.service';
import { createSfCliClient, extractPasswordFromCliResult, type SfOrgInfo } from '@sfcc/sf-cli';
import { decrypt, encrypt } from '../../common/crypto.util';
import { assertResourceOwner, connectedOrgWhere, userOwnedWhere } from '../../common/user-tenancy.util';
import { resolveOrgTypeFromInstance, isLikelyScratchOrg } from '../../common/org-type.util';
import { ScmAdapterRegistry } from '../../integrations/foundation/adapter.registry';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import { IntegrationAdminService } from '../integrations/integration-admin.service';
import { ExistingScratchOrgService } from './existing-scratch-org.service';
import { resolveSfProjectRoot } from '../../common/sf-project-root.util';

async function resolveScratchOrgPassword(
  sfCli: ReturnType<typeof createSfCliClient>,
  username: string,
  storedEncrypted: string | null | undefined,
): Promise<string | null> {
  if (storedEncrypted) {
    try {
      return decrypt(storedEncrypted);
    } catch {
      // corrupted or key rotated — ignore stored value
    }
  }

  try {
    const showResult = await sfCli.showUserPassword(username);
    if (showResult.success) {
      const password = extractPasswordFromCliResult(showResult);
      if (password) return password;
    }
  } catch {
    // show-user-password not available on older SF CLI versions
  }

  return null;
}

@Injectable()
export class EnvironmentService {
  private readonly sfCli = createSfCliClient({
    cwd: resolveSfProjectRoot(),
  });

  constructor(
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly scratchOrgJobService: ScratchOrgJobService,
    private readonly pipelineOrchestrator: PipelineOrchestratorService,
    private readonly azureService: AzureService,
    private readonly azureIntegration: AzureIntegrationService,
    private readonly scmAdapters: ScmAdapterRegistry,
    private readonly scmSources: ScmSourceService,
    private readonly integrationAdmin: IntegrationAdminService,
    private readonly orgsService: OrgsService,
    private readonly orgConfigLoader: OrgConfigLoaderService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly dataDeployOrchestrator: DataDeployOrchestratorService,
    private readonly existingScratchOrgs: ExistingScratchOrgService,
  ) {}

  deleteScratchOrg(alias: string, userId: string) {
    return this.orgsService.deleteScratchOrg(alias, userId);
  }

  disconnectOrg(alias: string, userId: string) {
    return this.orgsService.disconnectOrg(alias, userId);
  }

  /** Scratch org rows missing when creation only persisted OrgConnection. */
  private async reconcileOrphanScratchOrgs(userId: string) {
    const scratchConnections = await prisma.orgConnection.findMany({
      where: { ...userOwnedWhere(userId), type: 'scratch' },
      orderBy: { createdAt: 'desc' },
    });
    if (scratchConnections.length === 0) return;

    for (const conn of scratchConnections) {
      if (!isLikelyScratchOrg(conn)) continue;

      const existing = await prisma.scratchOrg.findUnique({
        where: { alias: conn.alias },
        select: { createdBy: true },
      });
      if (existing && existing.createdBy !== userId) continue;

      const status = conn.status === 'active' ? 'Active' : conn.status;
      try {
        await prisma.scratchOrg.upsert({
          where: { alias: conn.alias },
          create: {
            alias: conn.alias,
            username: conn.username ?? conn.alias,
            orgId: conn.orgId,
            instanceUrl: conn.instanceUrl,
            loginUrl: conn.loginUrl,
            expirationDate: conn.expiresAt,
            status,
            createdBy: userId,
          },
          update: {
            username: conn.username ?? conn.alias,
            orgId: conn.orgId,
            instanceUrl: conn.instanceUrl,
            loginUrl: conn.loginUrl,
            expirationDate: conn.expiresAt,
            status,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async reclassifyScratchConnections(userId: string) {
    const candidates = await prisma.orgConnection.findMany({
      where: { ...userOwnedWhere(userId), type: { not: 'scratch' } },
      select: { id: true, alias: true, instanceUrl: true, username: true },
    });

    await Promise.all(
      candidates
        .filter((org) => isLikelyScratchOrg(org))
        .map((org) =>
          prisma.orgConnection.update({
            where: { id: org.id },
            data: { type: 'scratch' },
          }),
        ),
    );
  }

  /** OAuth connects used to default to type scratch; fix rows that are not real scratch orgs. */
  private async repairMisclassifiedAuthenticatedOrgs(userId: string) {
    const scratchTypeOrgs = await prisma.orgConnection.findMany({
      where: { ...userOwnedWhere(userId), type: 'scratch' },
      select: { id: true, alias: true, isDevHub: true, instanceUrl: true, username: true },
    });
    if (scratchTypeOrgs.length === 0) return;

    const scratchRecords = await prisma.scratchOrg.findMany({
      where: { alias: { in: scratchTypeOrgs.map((o) => o.alias) } },
      select: { alias: true },
    });
    const realScratchAliases = new Set(scratchRecords.map((s) => s.alias));

    await Promise.all(
      scratchTypeOrgs
        .filter((org) => !realScratchAliases.has(org.alias) && !isLikelyScratchOrg(org))
        .map((org) =>
          prisma.orgConnection.update({
            where: { id: org.id },
            data: { type: resolveOrgTypeFromInstance(org.instanceUrl, org.isDevHub) },
          }),
        ),
    );
  }

  private async syncOrgConnectionCatalog(userId: string) {
    await this.reclassifyScratchConnections(userId);
    await this.reconcileOrphanScratchOrgs(userId);
    await this.repairMisclassifiedAuthenticatedOrgs(userId);
  }

  private mapConnectedOrg(o: {
    id: string;
    alias: string;
    username: string | null;
    type: string;
    status: string;
    instanceUrl: string;
    isDevHub: boolean;
    isDefaultDevHub: boolean;
    createdAt: Date;
  }) {
    return {
      id: o.id,
      alias: o.alias,
      username: o.username,
      orgType: o.isDevHub ? 'Dev Hub' : o.type,
      type: o.type,
      status: o.status === 'active' ? 'Connected' : o.status,
      instanceUrl: o.instanceUrl,
      isDevHub: o.isDevHub,
      isDefaultDevHub: o.isDefaultDevHub,
      createdAt: o.createdAt.toISOString(),
    };
  }

  async listScratchOrgs(userId: string) {
    await this.syncOrgConnectionCatalog(userId);
    const orgs = await prisma.scratchOrg.findMany({
      where: userOwnedWhere(userId),
      orderBy: { createdAt: 'desc' },
    });
    return orgs.map((org) => this.sanitizeScratchOrg(org));
  }

  private async requireScratchOrg(alias: string, userId: string) {
    const org = await prisma.scratchOrg.findUnique({ where: { alias } });
    assertResourceOwner(org, userId, 'Scratch org');
    return org!;
  }

  async getScratchOrgCredentials(alias: string, userId: string) {
    const org = await this.requireScratchOrg(alias, userId);

    try {
      const displayResult = await this.sfCli.displayOrg(org.username);
      if (displayResult.success) {
        const display = displayResult.data as {
          result?: {
            username?: string;
            orgId?: string;
            id?: string;
            instanceUrl?: string;
            loginUrl?: string;
            expirationDate?: string;
          };
        };
        const live = display?.result;
        if (live) {
          await prisma.scratchOrg.update({
            where: { alias },
            data: {
              username: live.username ?? org.username,
              orgId: live.orgId ?? live.id ?? org.orgId,
              instanceUrl: live.instanceUrl ?? org.instanceUrl,
              loginUrl: live.loginUrl ?? org.loginUrl,
              expirationDate: live.expirationDate ? new Date(live.expirationDate) : org.expirationDate,
            },
          });
        }
      }
    } catch {
      // use database values if live org display fails
    }

    const updated = await prisma.scratchOrg.findUnique({ where: { alias } });
    if (!updated) throw new NotFoundException(`Scratch org "${alias}" not found`);

    let password: string | null = null;
    try {
      password = await resolveScratchOrgPassword(this.sfCli, updated.username, updated.password);
      if (password && !updated.password) {
        await prisma.scratchOrg.update({
          where: { alias },
          data: { password: encrypt(password) },
        });
      }
    } catch {
      password = null;
    }

    return {
      alias: updated.alias,
      username: updated.username,
      password,
      orgId: updated.orgId,
      instanceUrl: updated.instanceUrl,
      loginUrl: updated.loginUrl,
      expirationDate: updated.expirationDate?.toISOString() ?? null,
      devHubAlias: updated.devHubAlias,
      status: updated.status,
      hasPassword: !!password,
    };
  }

  async regenerateScratchOrgPassword(alias: string, userId: string) {
    const org = await this.requireScratchOrg(alias, userId);

    const result = await this.sfCli.generatePassword(org.username);
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Failed to generate password');
    }

    let password = extractPasswordFromCliResult(result);
    if (!password) {
      password = (await resolveScratchOrgPassword(this.sfCli, org.username, null)) ?? undefined;
    }
    if (!password) {
      throw new BadRequestException('Password was not returned by Salesforce CLI');
    }

    await prisma.scratchOrg.update({
      where: { alias },
      data: { password: encrypt(password) },
    });

    return { alias, password };
  }

  private sanitizeScratchOrg(org: {
    id: string;
    alias: string;
    username: string;
    password?: string | null;
    orgId?: string | null;
    instanceUrl?: string | null;
    loginUrl?: string | null;
    expirationDate?: Date | null;
    devHubAlias?: string | null;
    status: string;
    jobId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const { password: _password, ...safe } = org;
    return {
      ...safe,
      hasPassword: !!org.password,
      expirationDate: org.expirationDate?.toISOString() ?? null,
    };
  }

  async listConnectedOrgs(userId: string) {
    await this.syncOrgConnectionCatalog(userId);
    const rows = await prisma.orgConnection.findMany({
      where: connectedOrgWhere(userId),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((o) => this.mapConnectedOrg(o));
  }

  async refreshConnectedOrgs(userId: string) {
    await this.syncOrgConnectionCatalog(userId);
    const result = await this.sfCli.listOrgs();
    if (!result.success || !result.data?.result) {
      throw new Error(result.error ?? 'Failed to list orgs from Salesforce CLI');
    }

    const nonScratch = (result.data.result.nonScratchOrgs ?? []) as SfOrgInfo[];
    const synced = [];

    for (const org of nonScratch) {
      if (!org.alias) continue;
      const type = resolveOrgTypeFromInstance(
        org.instanceUrl ?? 'https://login.salesforce.com',
        org.isDevHub ?? false,
      );
      const existing = await prisma.orgConnection.findUnique({
        where: { alias: org.alias },
        select: { createdBy: true },
      });
      if (existing && existing.createdBy !== userId) {
        continue;
      }
      const data = {
        username: org.username,
        orgId: org.orgId,
        instanceUrl: org.instanceUrl ?? 'https://login.salesforce.com',
        type,
        isDevHub: org.isDevHub ?? false,
        status: org.connectedStatus === 'Connected' ? 'active' as const : 'revoked' as const,
      };
      let record;
      if (existing) {
        record = await prisma.orgConnection.update({
          where: { alias: org.alias },
          data,
        });
      } else {
        try {
          record = await prisma.orgConnection.create({
            data: {
              alias: org.alias,
              ...data,
              createdBy: userId,
            },
          });
        } catch (error) {
          // A concurrent refresh may have claimed this globally unique alias.
          // Never fall back to updating a record that belongs to another user.
          if ((error as { code?: string }).code === 'P2002') continue;
          throw error;
        }
      }
      synced.push(record);
    }

    return this.listConnectedOrgs(userId);
  }

  async setDefaultDevHub(alias: string, userId: string) {
    const updated = await prisma.$transaction(async (tx) => {
      const target = await tx.orgConnection.findFirst({
        where: {
          alias,
          ...userOwnedWhere(userId),
          type: { not: 'scratch' },
          status: 'active',
          isDevHub: true,
        },
      });
      if (!target) throw new NotFoundException('Connected Dev Hub not found');
      await tx.orgConnection.updateMany({
        where: userOwnedWhere(userId),
        data: { isDefaultDevHub: false },
      });
      return tx.orgConnection.update({
        where: { id: target.id },
        data: { isDefaultDevHub: true },
      });
    });
    return this.mapConnectedOrg(updated);
  }

  async verifyOrgAuth(orgId: string, userId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    assertResourceOwner(org, userId, 'Org');
    const target = org.username ?? org.alias;
    const result = await this.sfCli.displayOrg(target);
    if (!result.success) {
      throw new BadRequestException(`Org "${org.alias}" is not authenticated. Connect via SF CLI first.`);
    }
    return { authenticated: true, alias: org.alias, username: target };
  }

  getAzureDefaults() {
    return this.azureIntegration.getCredentials().then((creds) => {
      const base = this.azureService.getDefaults();
      return {
        ...base,
        project: creds?.project ?? base.project,
      };
    });
  }

  listAzureRepos(project?: string) {
    return this.azureService.listRepos(project);
  }

  listAzureBranches(repo: string, project?: string) {
    return this.azureService.listBranches(project, repo);
  }

  getAzureConnection() {
    return this.azureIntegration.getStatus();
  }

  connectAzureDevOps(body: unknown, connectedBy?: string) {
    return this.azureIntegration.connect(body, connectedBy);
  }

  verifyAzureConnection(connectionId?: string) {
    return this.azureIntegration.verify(connectionId);
  }

  disconnectAzureDevOps(connectionId?: string) {
    return this.azureIntegration.disconnect(connectionId);
  }

  getScmConnection(provider: ScmProvider, connectionId?: string) {
    return this.scmAdapters.get(provider).getConnectionStatus({ connectionId });
  }

  async getScmDefaults(provider: ScmProvider, connectionId?: string) {
    const status = await this.getScmConnection(provider, connectionId);
    return {
      provider,
      connectionId: status.id ?? connectionId ?? null,
      namespace: status.namespace,
      connected: status.connected,
    };
  }

  listScmNamespaces(provider: ScmProvider, connectionId?: string) {
    return this.scmAdapters.get(provider).listNamespaces({ connectionId });
  }

  listScmRepos(
    provider: ScmProvider,
    query: { connectionId?: string; namespace?: string; project?: string },
  ) {
    return this.scmAdapters.get(provider).listRepositories(query);
  }

  async listScmBranches(provider: ScmProvider, source: Omit<GitSourceConfig, 'provider'>) {
    const resolved = await this.scmSources.resolve({ ...source, provider });
    return this.scmAdapters.get(provider).listBranches(resolved);
  }

  connectScm(provider: ScmProvider, body: unknown, connectedBy: string) {
    if (provider === 'azure_devops') {
      return this.connectAzureDevOps(body, connectedBy);
    }
    return this.integrationAdmin.connectScm(provider, body, connectedBy);
  }

  verifyScm(provider: ScmProvider, connectionId?: string) {
    if (provider === 'azure_devops') return this.verifyAzureConnection(connectionId);
    if (!connectionId) throw new BadRequestException('connectionId is required');
    return this.integrationAdmin.verifyScm(provider, connectionId);
  }

  disconnectScm(provider: ScmProvider, connectionId?: string) {
    if (provider === 'azure_devops') return this.disconnectAzureDevOps(connectionId);
    if (!connectionId) throw new BadRequestException('connectionId is required');
    return this.integrationAdmin.disconnectScm(provider, connectionId);
  }

  listProjectBindings(connectionId?: string) {
    return this.integrationAdmin.listBindings(connectionId);
  }

  saveProjectBinding(body: unknown, createdBy: string) {
    return this.integrationAdmin.saveBinding(body, createdBy);
  }

  deleteProjectBinding(id: string) {
    return this.integrationAdmin.deleteBinding(id);
  }

  async createScratchOrgPipeline(body: unknown, userId: string) {
    const eligibility = await this.existingScratchOrgs.requireEligible(
      (body ?? {}) as Record<string, unknown>,
      userId,
    );
    if (!eligibility.config) {
      throw new BadRequestException('Resolved launch configuration is unavailable');
    }
    return this.pipelineOrchestrator.startPipeline(eligibility.config, userId);
  }

  getScratchOrgPipelineEligibility(body: unknown, userId: string) {
    return this.existingScratchOrgs.eligibility(
      (body ?? {}) as Record<string, unknown>,
      userId,
    );
  }

  adoptScratchOrg(body: unknown, userId: string) {
    return this.existingScratchOrgs.adopt(body, userId);
  }

  async getAutomationRun(id: string, userId: string) {
    return this.pipelineOrchestrator.getRun(id, userId);
  }

  async getActiveAutomationRun(intent: string, userId: string) {
    return this.pipelineOrchestrator.getActiveRun(intent, userId);
  }

  async getRecentAutomationRuns(
    query: { target?: string; targetOrgConnectionId?: string; limit?: string },
    userId: string,
  ) {
    return this.pipelineOrchestrator.getRecentRuns(query, userId);
  }

  async resumeAutomationRun(id: string, body: unknown, userId: string) {
    return this.pipelineOrchestrator.resumeRun(id, body, userId);
  }

  async cancelAutomationRun(id: string, userId: string) {
    return this.pipelineOrchestrator.cancelRun(id, userId);
  }

  async runAutomationActions(id: string, body: unknown, userId: string) {
    return this.pipelineOrchestrator.runUserActions(id, body, userId);
  }

  async loadOrgConfig(orgId: string, body: unknown, userId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    assertResourceOwner(org, userId, 'Org');
    const { orgConfig } = (body ?? {}) as {
      orgConfig?: {
        upsertQueueIds?: boolean;
        upsertDomainFields?: boolean;
        upsertRequestId?: boolean;
        bottler?: string;
        configKey?: string;
      };
    };
    try {
      return await this.orgConfigLoader.loadForOrg(orgId, orgConfig ?? {});
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Load org config failed',
      );
    }
  }

  async createScratchOrg(body: unknown, userId: string) {
    const config = scratchOrgCreateSchema.parse(body) as ScratchOrgCreateConfig;

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.SCRATCH_ORG_CREATE,
        type: 'scratch_org_workflow',
        alias: config.alias,
        currentStep: 'Not Started',
        status: 'pending',
        createdBy: userId,
        payload: config as unknown as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.SCRATCH_ORG_CREATE,
      'scratch_org_workflow',
      { config, dbJobId: job.id },
      job.id,
    );

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'queued', currentStep: 'Pending' },
    });

    return {
      jobId: job.id,
      status: 'Pending',
      currentStep: 'Not Started',
      alias: config.alias,
    };
  }

  async getJob(jobId: string, userId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { logs: { orderBy: { timestamp: 'asc' } }, scratchOrg: true, parentRun: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.parentRun) {
      assertResourceOwner(job.parentRun, userId, 'Job');
    } else {
      assertResourceOwner(job, userId, 'Job');
    }
    return job;
  }

  async cancelJob(jobId: string, userId: string) {
    const job = await this.getJob(jobId, userId);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return { cancelled: false, reason: `Job already ${job.status}` };
    }

    // Cancel handlers per job family: scratch-org jobs, plus a generic process
    // registry used by data-deploy / SFDMU / metadata-deploy workers.
    this.scratchOrgJobService.cancel(jobId);
    await this.processRegistry.cancel(jobId);

    // Remove the queued Bull job from whichever queue owns it (queue name is
    // stored on the DB row and DB job ids double as Bull job ids).
    await this.queueService.removeJob(job.queue, jobId).catch(() => false);
    if (job.queue !== QUEUE_NAMES.SCRATCH_ORG_CREATE) {
      await this.queueService.removeJob(QUEUE_NAMES.SCRATCH_ORG_CREATE, jobId).catch(() => false);
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'cancelled', error: 'Cancelled by user', finishedAt: new Date() },
    });

    // Cascade cancellation into chunked data-deploy bookkeeping.
    const chunk = await prisma.dataDeployChunk.findFirst({ where: { jobId } });
    if (chunk) {
      await prisma.dataDeployChunk.updateMany({
        where: { id: chunk.id, status: { in: ['pending', 'queued', 'planning', 'running'] } },
        data: { status: 'cancelled', error: 'Cancelled by user' },
      });
      if (chunk.movementId) {
        await prisma.dataMovement.updateMany({
          where: { id: chunk.movementId, status: { in: ['pending', 'queued', 'running'] } },
          data: { status: 'cancelled' },
        });
      }
      await this.dataDeployOrchestrator.refreshBatchProgress(chunk.batchId);
    }

    await this.jobsService.addLog(jobId, 'stderr', 'Job cancelled by user');
    await this.streamService.publish('job_status', { jobId, status: 'cancelled' });

    return { cancelled: true, jobId };
  }

  async skipJobStep(jobId: string, body: unknown, userId: string) {
    const { step } = scratchOrgSkipStepSchema.parse(body);
    const job = await this.getJob(jobId, userId);
    if (!['pending', 'queued', 'running'].includes(job.status)) {
      throw new BadRequestException('Job is not active');
    }

    this.scratchOrgJobService.skipStep(jobId, step as ScratchOrgSkipStepKey);

    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const config = (payload.config ?? {}) as ScratchOrgCreateConfig;
    const skipSteps = new Set([...(config.skipSteps ?? []), step as ScratchOrgSkipStepKey]);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        payload: {
          ...payload,
          config: { ...config, skipSteps: [...skipSteps] },
        } as Prisma.InputJsonValue,
      },
    });

    await this.jobsService.addLog(jobId, 'stdout', `Skip requested: ${step}`);
    await this.streamService.publish('job_skip', { jobId, step });

    return { skipped: step, jobId };
  }
}
