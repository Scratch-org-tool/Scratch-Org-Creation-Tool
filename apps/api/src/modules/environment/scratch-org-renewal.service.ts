import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  computeRenewalRunAt,
  normalizeGitSourceConfig,
  scratchOrgPipelineSchema,
  scratchOrgRenewalCreateSchema,
  scratchOrgRenewalPreviewSchema,
  scratchOrgRenewalUpdateSchema,
  type ScratchOrgPipelineInput,
  type ScratchOrgRenewalConfigSummary,
} from '@sfcc/shared';
import { ZodError } from 'zod';
import { PipelineOrchestratorService } from '../orchestrator/pipeline-orchestrator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';
import { ExistingScratchOrgService } from './existing-scratch-org.service';

/** Salesforce CLI alias limit enforced by scratchOrgCreateSchema. */
const ALIAS_MAX_LENGTH = 40;
/** Re-arm delay after a failed renewal attempt. */
const RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
/** Failed renewals keep retrying until this long after the tracked org expires. */
const RETRY_GRACE_MS = 24 * 60 * 60 * 1000;

const PIPELINE_ACTIVE_STATUSES = ['pending', 'queued', 'planning', 'running'] as const;

type RenewalRecord = Prisma.ScratchOrgRenewalGetPayload<Record<string, never>>;
type CreateNewPipelineConfig = Extract<ScratchOrgPipelineInput, { mode: 'create_new' }>;

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Scratch org renewal automation. A renewal rule tracks one scratch org and a
 * sanitized copy of the pipeline configuration that created it. N days before
 * the tracked org expires the scheduler replays that configuration with a
 * fresh alias, so a fully configured replacement (metadata, custom settings,
 * data seed, partners, users) is ready before the old org goes away. Once the
 * replacement pipeline completes, the rule rolls forward to track the new org
 * and re-arms for the next cycle.
 */
@Injectable()
export class ScratchOrgRenewalService {
  private readonly logger = new Logger(ScratchOrgRenewalService.name);

  constructor(
    private readonly pipelineOrchestrator: PipelineOrchestratorService,
    private readonly notifications: NotificationsService,
    private readonly scratchOrgEligibility: ExistingScratchOrgService,
  ) {}

  async list(userId: string) {
    const renewals = await prisma.scratchOrgRenewal.findMany({
      where: userOwnedWhere(userId),
      orderBy: { createdAt: 'desc' },
    });
    const aliases = [
      ...new Set(
        renewals.flatMap((renewal) =>
          [renewal.scratchOrgAlias, renewal.activeRunAlias].filter(
            (alias): alias is string => Boolean(alias),
          ),
        ),
      ),
    ];
    const orgs = aliases.length
      ? await prisma.scratchOrg.findMany({
          where: { alias: { in: aliases } },
          select: { alias: true, expirationDate: true, status: true, username: true },
        })
      : [];
    const orgByAlias = new Map(orgs.map((org) => [org.alias, org]));
    return renewals.map((renewal) => this.toListItem(renewal, orgByAlias));
  }

  /**
   * Dry-run of rule creation: resolves the source pipeline run and validates
   * that its configuration can be replayed, without persisting anything.
   */
  async preview(body: unknown, userId: string) {
    const input = scratchOrgRenewalPreviewSchema.parse(body);
    const scratchOrg = await this.requireScratchOrg(input.scratchOrgAlias, userId);
    const expirationDate = await this.resolveExpiration(scratchOrg);
    try {
      const sourceRun = await this.resolveSourceRun(
        input.scratchOrgAlias,
        userId,
        input.sourceAutomationRunId,
      );
      const snapshot = await this.buildConfigSnapshot(
        sourceRun.config as Record<string, unknown>,
        scratchOrg,
        userId,
      );
      return {
        eligible: true,
        reason: null,
        scratchOrg: {
          alias: scratchOrg.alias,
          expirationDate: expirationDate?.toISOString() ?? null,
        },
        sourceRun: {
          id: sourceRun.id,
          status: sourceRun.status,
          createdAt: sourceRun.createdAt.toISOString(),
        },
        summary: this.summarizeConfig(snapshot),
      };
    } catch (error) {
      return {
        eligible: false,
        reason: errorMessage(error),
        scratchOrg: {
          alias: scratchOrg.alias,
          expirationDate: expirationDate?.toISOString() ?? null,
        },
        sourceRun: null,
        summary: null,
      };
    }
  }

  async create(body: unknown, userId: string) {
    const input = scratchOrgRenewalCreateSchema.parse(body);
    const scratchOrg = await this.requireScratchOrg(input.scratchOrgAlias, userId);

    const expirationDate = await this.resolveExpiration(scratchOrg);
    if (!expirationDate) {
      throw new BadRequestException(
        `Scratch org "${scratchOrg.alias}" has no known expiration date. `
        + 'Open its credentials once to sync the expiration from Salesforce, then try again.',
      );
    }

    const sourceRun = await this.resolveSourceRun(
      input.scratchOrgAlias,
      userId,
      input.sourceAutomationRunId,
    );
    let snapshot: CreateNewPipelineConfig;
    try {
      snapshot = await this.buildConfigSnapshot(
        sourceRun.config as Record<string, unknown>,
        scratchOrg,
        userId,
      );
    } catch (error) {
      throw new BadRequestException(
        `The stored pipeline configuration cannot be replayed: ${errorMessage(error)}`,
      );
    }

    try {
      const renewal = await prisma.scratchOrgRenewal.create({
        data: {
          name: input.name ?? `Auto-renew ${scratchOrg.alias}`,
          scratchOrgAlias: scratchOrg.alias,
          configSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          sourceAutomationRunId: sourceRun.id,
          daysBeforeExpiry: input.daysBeforeExpiry,
          enabled: input.enabled,
          trackedExpirationDate: expirationDate,
          nextRunAt: input.enabled
            ? computeRenewalRunAt(expirationDate, input.daysBeforeExpiry)
            : null,
          createdBy: userId,
        },
      });
      return this.toListItem(renewal, new Map([[scratchOrg.alias, scratchOrg]]));
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `A renewal automation already tracks "${scratchOrg.alias}"`,
        );
      }
      throw error;
    }
  }

  async update(id: string, body: unknown, userId: string) {
    const renewal = await this.requireRenewal(id, userId);
    const input = scratchOrgRenewalUpdateSchema.parse(body);

    const daysBeforeExpiry = input.daysBeforeExpiry ?? renewal.daysBeforeExpiry;
    const enabled = input.enabled ?? renewal.enabled;

    // Re-arm from the tracked org's current expiration unless a replacement
    // pipeline is in flight (finalize will re-arm with the fresh expiration).
    let nextRunAt: Date | null = null;
    let trackedExpirationDate = renewal.trackedExpirationDate;
    if (enabled && !renewal.activeAutomationRunId) {
      const org = await prisma.scratchOrg.findUnique({
        where: { alias: renewal.scratchOrgAlias },
        select: { expirationDate: true },
      });
      const expiration = org?.expirationDate ?? renewal.trackedExpirationDate;
      if (!expiration) {
        throw new BadRequestException(
          `Cannot schedule: no expiration date is known for "${renewal.scratchOrgAlias}"`,
        );
      }
      trackedExpirationDate = expiration;
      nextRunAt = computeRenewalRunAt(expiration, daysBeforeExpiry);
    }

    const updated = await prisma.scratchOrgRenewal.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        daysBeforeExpiry,
        enabled,
        trackedExpirationDate,
        ...(renewal.activeAutomationRunId ? {} : { nextRunAt }),
      },
    });
    return this.toListItem(updated, await this.orgMapFor(updated));
  }

  async remove(id: string, userId: string) {
    await this.requireRenewal(id, userId);
    await prisma.scratchOrgRenewal.delete({ where: { id } });
    return { deleted: true, id };
  }

  async listRuns(id: string, userId: string, limit = 20) {
    await this.requireRenewal(id, userId);
    return prisma.scratchOrgRenewalRun.findMany({
      where: { renewalId: id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  /** Manual trigger from the panel — fires immediately, owner-checked. */
  async runNow(id: string, userId: string) {
    const renewal = await this.requireRenewal(id, userId);
    if (renewal.activeAutomationRunId) {
      throw new ConflictException(
        'A renewal pipeline is already running for this automation',
      );
    }
    const started = await this.fire(renewal, 'manual', new Date());
    return { renewalId: id, ...started };
  }

  // ------------------------------------------------------------------
  // Scheduler API
  // ------------------------------------------------------------------

  /** Ids of renewal rules whose fire time has arrived. */
  async dueRenewalIds(now = new Date(), take = 25): Promise<string[]> {
    const rows = await prisma.scratchOrgRenewal.findMany({
      where: {
        enabled: true,
        activeAutomationRunId: null,
        nextRunAt: { not: null, lte: now },
      },
      orderBy: { nextRunAt: 'asc' },
      take,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /**
   * Claim a due renewal and start its replacement pipeline. The claim clears
   * nextRunAt in a single conditional update so, across clustered API
   * replicas, exactly one caller wins per slot. The next fire time is only
   * known once the replacement org exists, so it is re-armed by
   * {@link finalizeActiveRuns} (or the failure retry policy).
   */
  async runScheduledRenewal(id: string, now = new Date()): Promise<{ claimed: boolean }> {
    const renewal = await prisma.scratchOrgRenewal.findUnique({ where: { id } });
    if (!renewal || !renewal.enabled || renewal.activeAutomationRunId) {
      return { claimed: false };
    }
    const claim = await prisma.scratchOrgRenewal.updateMany({
      where: {
        id,
        enabled: true,
        activeAutomationRunId: null,
        nextRunAt: { not: null, lte: now },
      },
      data: { nextRunAt: null },
    });
    if (claim.count !== 1) return { claimed: false };
    await this.fire(renewal, 'schedule', now).catch(() => undefined);
    return { claimed: true };
  }

  /**
   * Watch replacement pipelines started by renewals. Completed runs roll the
   * rule forward to the new org and re-arm the next cycle; failed runs apply
   * the retry policy; paused runs notify the owner once so they can resume
   * from the create-scratch-org workspace.
   */
  async finalizeActiveRuns(now = new Date()): Promise<number> {
    const active = await prisma.scratchOrgRenewal.findMany({
      where: { activeAutomationRunId: { not: null } },
      take: 50,
    });
    let finalized = 0;
    for (const renewal of active) {
      try {
        if (await this.finalizeOne(renewal, now)) finalized += 1;
      } catch (error) {
        this.logger.warn(
          `renewal ${renewal.id} finalize failed: ${errorMessage(error)}`,
        );
      }
    }
    return finalized;
  }

  private async finalizeOne(renewal: RenewalRecord, now: Date): Promise<boolean> {
    const runId = renewal.activeAutomationRunId!;
    const run = await prisma.automationRun.findUnique({
      where: { id: runId },
      select: { status: true, lastError: true },
    });

    if (!run) {
      await this.handleRenewalFailure(renewal, 'Replacement pipeline run no longer exists', now);
      return true;
    }
    if ((PIPELINE_ACTIVE_STATUSES as readonly string[]).includes(run.status)) {
      return false;
    }

    if (run.status === 'awaiting_input') {
      // Manual post-deploy steps remain part of the replacement recipe. Keep
      // the renewal and target lock active until the owner finishes them.
      if (renewal.lastRunStatus !== 'awaiting_input') {
        await prisma.scratchOrgRenewal.update({
          where: { id: renewal.id },
          data: { lastRunStatus: 'awaiting_input', lastError: null },
        });
        await this.notifyOwner(
          renewal,
          'warning',
          `Scratch org renewal is awaiting input: ${renewal.name}`,
          `The replacement org "${renewal.activeRunAlias ?? 'scratch org'}" was created, `
          + 'but its configured manual post-deploy actions still need to be run from '
          + 'the Create Scratch Org workspace.',
        );
      }
      return false;
    }

    if (run.status === 'paused') {
      // Recoverable — the owner can resume the pipeline. Notify on the first
      // transition only, then keep watching.
      if (renewal.lastRunStatus !== 'paused') {
        await prisma.scratchOrgRenewal.update({
          where: { id: renewal.id },
          data: { lastRunStatus: 'paused', lastError: run.lastError },
        });
        await this.notifyOwner(
          renewal,
          'warning',
          `Scratch org renewal needs attention: ${renewal.name}`,
          `The replacement pipeline for "${renewal.scratchOrgAlias}" paused: `
          + `${run.lastError ?? 'unknown error'}. Resume it from the Create Scratch Org workspace.`,
        );
      }
      return false;
    }

    if (run.status === 'completed' || run.status === 'partial') {
      await this.rollForward(renewal, run.status, now);
      return true;
    }

    if (run.status === 'cancelled') {
      await prisma.scratchOrgRenewal.update({
        where: { id: renewal.id },
        data: {
          enabled: false,
          nextRunAt: null,
          activeAutomationRunId: null,
          activeRunAlias: null,
          lastRunStatus: 'cancelled',
          lastError: 'Replacement pipeline was cancelled',
        },
      });
      await this.closeRenewalRun(renewal.id, runId, 'failed', 'Replacement pipeline was cancelled', now);
      await this.notifyOwner(
        renewal,
        'warning',
        `Scratch org renewal disabled: ${renewal.name}`,
        `The replacement pipeline for "${renewal.scratchOrgAlias}" was cancelled. `
        + 'Re-enable the automation to schedule the next renewal.',
      );
      return true;
    }

    await this.handleRenewalFailure(
      renewal,
      run.lastError ?? 'Replacement pipeline failed',
      now,
    );
    return true;
  }

  private async rollForward(
    renewal: RenewalRecord,
    runStatus: 'completed' | 'partial',
    now: Date,
  ) {
    const runId = renewal.activeAutomationRunId!;
    const newAlias = renewal.activeRunAlias;
    const newOrg = newAlias
      ? await prisma.scratchOrg.findUnique({ where: { alias: newAlias } })
      : null;
    if (!newAlias || !newOrg) {
      await this.handleRenewalFailure(
        renewal,
        'Replacement pipeline finished but the new scratch org record was not found',
        now,
      );
      return;
    }

    const snapshot = renewal.configSnapshot as unknown as Partial<CreateNewPipelineConfig>;
    const durationDays = typeof snapshot.duration === 'number' ? snapshot.duration : 30;
    const newExpiration =
      newOrg.expirationDate
      ?? new Date(newOrg.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const status = runStatus === 'partial' ? 'partial' : 'succeeded';

    try {
      await prisma.scratchOrgRenewal.update({
        where: { id: renewal.id },
        data: {
          scratchOrgAlias: newAlias,
          trackedExpirationDate: newExpiration,
          nextRunAt: computeRenewalRunAt(newExpiration, renewal.daysBeforeExpiry),
          activeAutomationRunId: null,
          activeRunAlias: null,
          lastRunStatus: status,
          lastError: null,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      // Another rule already tracks the new alias — keep this rule on the old
      // org but stop watching the finished run.
      await prisma.scratchOrgRenewal.update({
        where: { id: renewal.id },
        data: {
          enabled: false,
          nextRunAt: null,
          activeAutomationRunId: null,
          activeRunAlias: null,
          lastRunStatus: 'failed',
          lastError: `Another renewal automation already tracks "${newAlias}"`,
        },
      });
    }
    await this.closeRenewalRun(renewal.id, runId, status, null, now);
    await this.notifyOwner(
      renewal,
      status === 'partial' ? 'warning' : 'success',
      `Scratch org renewed: ${renewal.scratchOrgAlias} → ${newAlias}`,
      status === 'partial'
        ? `Replacement org "${newAlias}" is ready, but some data steps finished with warnings. `
          + `It expires ${newExpiration.toISOString().slice(0, 10)}.`
        : `Replacement org "${newAlias}" is fully configured and ready. `
          + `The old org "${renewal.scratchOrgAlias}" can keep being used until it expires. `
          + `The automation now tracks "${newAlias}" (expires ${newExpiration.toISOString().slice(0, 10)}).`,
    );
  }

  /** Retry while the tracked org is still within its life (+ one day of grace); otherwise disable. */
  private async handleRenewalFailure(renewal: RenewalRecord, message: string, now: Date) {
    const runId = renewal.activeAutomationRunId;
    const expiration = renewal.trackedExpirationDate;
    const canRetry =
      Boolean(expiration) && now.getTime() < expiration!.getTime() + RETRY_GRACE_MS;
    const retryAt = new Date(now.getTime() + RETRY_DELAY_MS);

    await prisma.scratchOrgRenewal.update({
      where: { id: renewal.id },
      data: {
        activeAutomationRunId: null,
        activeRunAlias: null,
        lastRunStatus: 'failed',
        lastError: message.slice(0, 2000),
        ...(canRetry ? { nextRunAt: retryAt } : { enabled: false, nextRunAt: null }),
      },
    });
    if (runId) {
      await this.closeRenewalRun(renewal.id, runId, 'failed', message, now);
    }
    await this.notifyOwner(
      renewal,
      'error',
      `Scratch org renewal failed: ${renewal.name}`,
      `${message.slice(0, 240)} ${
        canRetry
          ? `— the renewal will retry automatically at ${retryAt.toISOString()}.`
          : '— the automation was disabled; fix the issue and re-enable it.'
      }`,
    );
  }

  private async closeRenewalRun(
    renewalId: string,
    automationRunId: string,
    status: string,
    error: string | null,
    now: Date,
  ) {
    await prisma.scratchOrgRenewalRun.updateMany({
      where: { renewalId, automationRunId, status: 'started' },
      data: { status, error: error ? error.slice(0, 2000) : null, finishedAt: now },
    });
  }

  /**
   * Start the replacement pipeline: generate a fresh alias, re-validate the
   * stored configuration, and hand it to the pipeline orchestrator exactly as
   * a manual launch would.
   */
  private async fire(renewal: RenewalRecord, trigger: 'schedule' | 'manual', now: Date) {
    let runRow: { id: string } | undefined;
    try {
      runRow = await prisma.scratchOrgRenewalRun.create({
        data: {
          renewalId: renewal.id,
          trigger,
          status: 'started',
          sourceAlias: renewal.scratchOrgAlias,
          createdBy: renewal.createdBy,
        },
      });
      const newAlias = await this.generateRenewalAlias(renewal.scratchOrgAlias);
      const snapshot = {
        ...(renewal.configSnapshot as unknown as Record<string, unknown>),
      };
      delete snapshot.templateId;
      const launch = scratchOrgPipelineSchema.parse({
        ...snapshot,
        mode: 'create_new',
        alias: newAlias,
        automationRunId: undefined,
        existingOrgConnectionId: undefined,
      }) as CreateNewPipelineConfig;

      const eligibility = await this.scratchOrgEligibility.requireEligible(
        launch as unknown as Record<string, unknown>,
        renewal.createdBy,
      );
      const started = await this.pipelineOrchestrator.startPipeline(
        eligibility.config as CreateNewPipelineConfig,
        renewal.createdBy,
      );

      await prisma.scratchOrgRenewalRun.update({
        where: { id: runRow.id },
        data: { newAlias, automationRunId: started.automationRunId },
      });
      await prisma.scratchOrgRenewal.update({
        where: { id: renewal.id },
        data: {
          activeAutomationRunId: started.automationRunId,
          activeRunAlias: newAlias,
          lastRunAt: now,
          lastRunStatus: 'started',
          lastError: null,
          nextRunAt: null,
        },
      });
      return started;
    } catch (error) {
      const message = errorMessage(error);
      if (runRow) {
        await prisma.scratchOrgRenewalRun
          .update({
            where: { id: runRow.id },
            data: { status: 'failed', error: message.slice(0, 2000), finishedAt: now },
          })
          .catch(() => undefined);
      }
      await this.handleRenewalFailure(
        { ...renewal, activeAutomationRunId: null },
        message,
        now,
      ).catch(() => undefined);
      throw error instanceof BadRequestException || error instanceof ConflictException
        ? error
        : new BadRequestException(`Renewal could not start: ${message}`);
    }
  }

  // ------------------------------------------------------------------
  // Config snapshot + alias helpers
  // ------------------------------------------------------------------

  /**
   * Sanitize a stored pipeline configuration into a replayable create_new
   * launch: strips run-scoped fields, forces create_new mode, and fills the
   * Dev Hub from the scratch org record or the caller's default Dev Hub when
   * the original run targeted an existing org. Throws when the result would
   * not pass launch validation.
   */
  private async buildConfigSnapshot(
    rawConfig: Record<string, unknown> | null,
    scratchOrg: { alias: string; devHubAlias?: string | null },
    userId: string,
  ): Promise<CreateNewPipelineConfig> {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw new BadRequestException('Source pipeline run has no stored configuration');
    }
    const normalized = normalizeGitSourceConfig({
      ...rawConfig,
    } as Record<string, unknown>) as Record<string, unknown>;
    delete normalized.existingOrgConnectionId;
    delete normalized.existingOrgOptions;
    delete normalized.automationRunId;
    // The renewal snapshot is immutable execution input. Re-resolving a
    // template id here could silently switch a scheduled renewal to a newer
    // template revision.
    delete normalized.templateId;

    const devHubAlias =
      (typeof normalized.devHubAlias === 'string' && normalized.devHubAlias)
      || scratchOrg.devHubAlias
      || (await this.defaultDevHubAlias(userId));
    if (!devHubAlias) {
      throw new BadRequestException(
        'No Dev Hub could be determined for the renewal. Set a default Dev Hub in the Environment Center.',
      );
    }

    return scratchOrgPipelineSchema.parse({
      ...normalized,
      mode: 'create_new',
      // Placeholder — replaced with a fresh generated alias at fire time.
      alias: scratchOrg.alias,
      devHubAlias,
    }) as CreateNewPipelineConfig;
  }

  private async defaultDevHubAlias(userId: string): Promise<string | null> {
    const hub =
      (await prisma.orgConnection.findFirst({
        where: { createdBy: userId, isDefaultDevHub: true, status: 'active' },
        select: { alias: true },
      }))
      ?? (await prisma.orgConnection.findFirst({
        where: { createdBy: userId, isDevHub: true, status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { alias: true },
      }));
    return hub?.alias ?? null;
  }

  /**
   * Latest successful creation pipeline for the tracked org, or an explicit
   * run the caller selected. Renewal is only possible for orgs created (or
   * configured) through the scratch org pipeline, because that run's config
   * is the recipe being replayed.
   */
  private async resolveSourceRun(alias: string, userId: string, explicitRunId?: string) {
    if (explicitRunId) {
      const run = await prisma.automationRun.findUnique({ where: { id: explicitRunId } });
      assertResourceOwner(run, userId, 'Automation run');
      const record = run as NonNullable<typeof run>;
      if (record.intent !== 'scratch_org_pipeline' || !record.config) {
        throw new BadRequestException(
          'Selected run is not a scratch org pipeline with a stored configuration',
        );
      }
      return record;
    }

    const connection = await prisma.orgConnection.findUnique({
      where: { alias },
      select: { id: true },
    });
    const run = await prisma.automationRun.findFirst({
      where: {
        intent: 'scratch_org_pipeline',
        createdBy: userId,
        status: { in: ['completed', 'partial'] },
        OR: [
          ...(connection ? [{ targetOrgConnectionId: connection.id }] : []),
          { config: { path: ['alias'], equals: alias } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!run?.config) {
      throw new BadRequestException(
        `No completed creation pipeline was found for "${alias}". `
        + 'Renewal automation replays the original pipeline, so it is only available for '
        + 'orgs created or configured through the scratch org pipeline.',
      );
    }
    return run;
  }

  /**
   * Fresh, globally unique alias for the replacement org, derived from the
   * tracked alias: `myorg` → `myorg-r2` → `myorg-r3` …, truncating the root
   * to honor the 40-character CLI alias limit.
   */
  private async generateRenewalAlias(currentAlias: string): Promise<string> {
    const match = /^(.*?)-r(\d+)$/.exec(currentAlias);
    const root = (match ? match[1]! : currentAlias) || 'scratch';
    let counter = match ? parseInt(match[2]!, 10) + 1 : 2;

    for (let attempts = 0; attempts < 200; attempts += 1, counter += 1) {
      const suffix = `-r${counter}`;
      const base = root.slice(0, Math.max(1, ALIAS_MAX_LENGTH - suffix.length));
      const candidate = `${base}${suffix}`;
      const [org, connection, rule] = await Promise.all([
        prisma.scratchOrg.findUnique({ where: { alias: candidate }, select: { id: true } }),
        prisma.orgConnection.findUnique({ where: { alias: candidate }, select: { id: true } }),
        prisma.scratchOrgRenewal.findUnique({
          where: { scratchOrgAlias: candidate },
          select: { id: true },
        }),
      ]);
      if (!org && !connection && !rule) return candidate;
    }
    throw new BadRequestException(
      `Could not find a free replacement alias for "${currentAlias}"`,
    );
  }

  // ------------------------------------------------------------------
  // Shaping helpers
  // ------------------------------------------------------------------

  private async requireScratchOrg(alias: string, userId: string) {
    const org = await prisma.scratchOrg.findUnique({ where: { alias } });
    assertResourceOwner(org, userId, 'Scratch org');
    return org as NonNullable<typeof org>;
  }

  private async requireRenewal(id: string, userId: string) {
    const renewal = await prisma.scratchOrgRenewal.findUnique({ where: { id } });
    assertResourceOwner(renewal, userId, 'Renewal automation');
    return renewal as NonNullable<typeof renewal>;
  }

  /** Tracked org expiration, preferring the ScratchOrg record and falling back to the connection catalog. */
  private async resolveExpiration(scratchOrg: {
    alias: string;
    expirationDate: Date | null;
  }): Promise<Date | null> {
    if (scratchOrg.expirationDate) return scratchOrg.expirationDate;
    const connection = await prisma.orgConnection.findUnique({
      where: { alias: scratchOrg.alias },
      select: { expiresAt: true },
    });
    return connection?.expiresAt ?? null;
  }

  private async orgMapFor(renewal: RenewalRecord) {
    const aliases = [renewal.scratchOrgAlias, renewal.activeRunAlias].filter(
      (alias): alias is string => Boolean(alias),
    );
    const orgs = await prisma.scratchOrg.findMany({
      where: { alias: { in: aliases } },
      select: { alias: true, expirationDate: true, status: true, username: true },
    });
    return new Map(orgs.map((org) => [org.alias, org]));
  }

  /**
   * API shape for the panel. The raw configSnapshot is intentionally omitted
   * (it can embed large uploads such as partner Excel files); the summary
   * carries what the panel needs.
   */
  private toListItem(
    renewal: RenewalRecord,
    orgByAlias: Map<string, { expirationDate: Date | null; status: string; username?: string | null }>,
  ) {
    const tracked = orgByAlias.get(renewal.scratchOrgAlias);
    const expirationDate = tracked?.expirationDate ?? renewal.trackedExpirationDate;
    return {
      id: renewal.id,
      name: renewal.name,
      scratchOrgAlias: renewal.scratchOrgAlias,
      daysBeforeExpiry: renewal.daysBeforeExpiry,
      enabled: renewal.enabled,
      nextRunAt: renewal.nextRunAt?.toISOString() ?? null,
      trackedOrg: {
        alias: renewal.scratchOrgAlias,
        username: tracked?.username ?? null,
        status: tracked?.status ?? 'Unknown',
        expirationDate: expirationDate?.toISOString() ?? null,
      },
      activeAutomationRunId: renewal.activeAutomationRunId,
      activeRunAlias: renewal.activeRunAlias,
      lastRunAt: renewal.lastRunAt?.toISOString() ?? null,
      lastRunStatus: renewal.lastRunStatus,
      lastError: renewal.lastError,
      sourceAutomationRunId: renewal.sourceAutomationRunId,
      summary: this.summarizeConfig(
        renewal.configSnapshot as unknown as Partial<CreateNewPipelineConfig>,
      ),
      createdAt: renewal.createdAt.toISOString(),
      updatedAt: renewal.updatedAt.toISOString(),
    };
  }

  private summarizeConfig(
    config: Partial<CreateNewPipelineConfig>,
  ): ScratchOrgRenewalConfigSummary {
    const steps = config.pipelineSteps ?? {
      autoRunDataSeed: true,
      autoRunPartners: false,
      autoRunUsers: true,
    };
    const provisioning = config.userProvisioning;
    const hasUsers = Boolean(
      (provisioning?.users?.length ?? 0)
      + (provisioning?.slots?.length ?? 0)
      + (provisioning?.userGenerators?.length ?? 0),
    );
    return {
      duration: typeof config.duration === 'number' ? config.duration : 30,
      devHubAlias: config.devHubAlias ?? null,
      metadataSource: config.gitSource
        ? `${config.gitSource.repo}@${config.gitSource.branch}`
        : null,
      customSettings: config.customSettings?.enabled !== false,
      dataSeed: steps.autoRunDataSeed !== false,
      accountPartners: steps.autoRunPartners === true,
      userProvisioning: steps.autoRunUsers !== false && hasUsers,
    };
  }

  private async notifyOwner(
    renewal: RenewalRecord,
    level: 'info' | 'success' | 'warning' | 'error',
    title: string,
    body: string,
  ) {
    if (!renewal.createdBy || renewal.createdBy === 'system') return;
    await this.notifications
      .notify({
        userId: renewal.createdBy,
        category: 'environment',
        level,
        title,
        body,
        link: '/environment-center/automation',
        metadata: { renewalId: renewal.id },
      })
      .catch(() => undefined);
  }
}
