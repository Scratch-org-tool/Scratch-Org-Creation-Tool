import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  getCustomSettingsOrgId,
  getDataDeploymentOrgId,
  scratchOrgAdoptSchema,
  type ScratchOrgPipelineInput,
} from '@sfcc/shared';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import { ScratchTemplatesService } from '../scratch-templates/scratch-templates.service';
import { ScratchOrgPreparationService } from './scratch-org-preparation.service';

type EligibilityStatus = 'required' | 'skipped' | 'warning' | 'error';

export interface ExistingOrgEligibilityStep {
  step:
    | 'template'
    | 'target'
    | 'dev_hub'
    | 'authentication'
    | 'required_package'
    | 'provider'
    | 'sources'
    | 'active_run';
  status: EligibilityStatus;
  messages: string[];
}

const ACTIVE_RUN_STATUSES = [
  'pending',
  'queued',
  'planning',
  'running',
  'paused',
  'awaiting_input',
] as const;

@Injectable()
export class ExistingScratchOrgService {
  constructor(
    private readonly templates: ScratchTemplatesService,
    private readonly scmSources: ScmSourceService,
    private readonly preparation: ScratchOrgPreparationService,
  ) {}

  async eligibility(body: Record<string, unknown>, userId: string) {
    const steps: ExistingOrgEligibilityStep[] = [];
    let config: ScratchOrgPipelineInput;
    try {
      config = await this.templates.resolveLaunch(body, userId);
      steps.push({ step: 'template', status: 'required', messages: ['Launch configuration is valid'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.result(undefined, undefined, [
        { step: 'template', status: 'error', messages: [message] },
      ]);
    }

    if (config.mode !== 'configure_existing') {
      steps.push({
        step: 'target',
        status: 'skipped',
        messages: ['Existing scratch-org checks do not apply to create_new mode'],
      });
      await this.validateDevHub(config, userId, steps);
      await this.validateProviderAndSources(config, userId, steps);
      return this.result(config, undefined, steps);
    }

    steps.push({
      step: 'dev_hub',
      status: 'skipped',
      messages: ['Existing scratch-org mode does not create through a Dev Hub'],
    });

    let target;
    const targetErrors: string[] = [];
    try {
      ({ target } = await this.preparation.requireOwnedActiveScratchTarget(
        config.existingOrgConnectionId,
        userId,
      ));
    } catch (error) {
      targetErrors.push(error instanceof Error ? error.message : String(error));
    }
    steps.push({
      step: 'target',
      status: targetErrors.length ? 'error' : 'required',
      messages: targetErrors.length ? targetErrors : ['Caller-owned active scratch org selected'],
    });

    if (target && !targetErrors.length) {
      const options = config.existingOrgOptions;
      steps.push({
        step: 'authentication',
        status: 'required',
        messages: ['Live Salesforce CLI scratch identity verified'],
      });

      if (options.ensureRequiredPackage) {
        try {
          const installed = await this.preparation.isRequiredPackageInstalled(target);
          steps.push({
            step: 'required_package',
            status: installed ? 'skipped' : 'required',
            messages: [
              installed
                ? 'Required package is already installed'
                : 'Required package will be installed before metadata deployment',
            ],
          });
        } catch (error) {
          steps.push({
            step: 'required_package',
            status: 'error',
            messages: [error instanceof Error ? error.message : String(error)],
          });
        }
      } else {
        steps.push({
          step: 'required_package',
          status: 'skipped',
          messages: ['Required package check and installation were disabled'],
        });
      }
    } else {
      steps.push({
        step: 'authentication',
        status: 'skipped',
        messages: ['Authentication was not checked because the target is invalid'],
      });
      steps.push({
        step: 'required_package',
        status: 'skipped',
        messages: ['Package state was not checked because the target is invalid'],
      });
    }

    await this.validateProviderAndSources(config, userId, steps, target?.id);

    let conflictRunId: string | undefined;
    if (target && !targetErrors.length) {
      const candidates = await prisma.automationRun.findMany({
        where: {
          intent: 'scratch_org_pipeline',
          status: { in: [...ACTIVE_RUN_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, targetOrgConnectionId: true, checkpoint: true },
      });
      conflictRunId = candidates.find((run) => {
        if (run.targetOrgConnectionId === target.id) return true;
        const checkpoint = (run.checkpoint ?? {}) as Record<string, unknown>;
        return checkpoint.targetOrgConnectionId === target.id;
      })?.id;
    }
    steps.push({
      step: 'active_run',
      status: conflictRunId ? 'error' : 'required',
      messages: conflictRunId
        ? [`Target already has active automation run ${conflictRunId}`]
        : ['No active pipeline is using this target'],
    });

    const authoritativeConfig = target && !targetErrors.length
      ? { ...config, alias: target.alias }
      : config;
    return this.result(authoritativeConfig, target ?? undefined, steps, conflictRunId);
  }

  async requireEligible(body: Record<string, unknown>, userId: string) {
    const result = await this.eligibility(body, userId);
    if (!result.eligible) {
      if (result.conflictRunId) {
        throw new ConflictException({
          message: 'An active pipeline already targets this scratch org',
          conflictRunId: result.conflictRunId,
        });
      }
      throw new BadRequestException({
        message: 'Scratch org pipeline is not eligible to launch',
        errors: result.errors,
        steps: result.steps,
      });
    }
    if (!result.config) throw new BadRequestException('Resolved launch configuration is unavailable');
    return result;
  }

  async adopt(body: unknown, userId: string) {
    const { alias } = scratchOrgAdoptSchema.parse(body);
    let live;
    try {
      live = await this.preparation.requireLiveScratchIdentity({ alias });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not authenticated as a scratch org')) {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
    const cliOrg = live.listed;
    const details = live.details;
    const resolvedAlias = cliOrg.alias!;
    const username = live.username;
    const orgId = live.orgId;

    const [connectionCollision, scratchCollision] = await Promise.all([
      prisma.orgConnection.findFirst({
        where: {
          OR: [
            { alias: resolvedAlias },
            { username },
            ...(orgId ? [{ orgId }] : []),
          ],
        },
      }),
      prisma.scratchOrg.findFirst({
        where: {
          OR: [
            { alias: resolvedAlias },
            { username },
            ...(orgId ? [{ orgId }] : []),
          ],
        },
      }),
    ]);
    if (
      (connectionCollision && connectionCollision.createdBy !== userId)
      || (scratchCollision && scratchCollision.createdBy !== userId)
    ) {
      throw new ConflictException('Scratch org is already associated with another user');
    }

    const expirationDate = live.expirationDate;
    const instanceUrl = details.instanceUrl ?? cliOrg.instanceUrl;
    if (!instanceUrl) throw new BadRequestException('Salesforce CLI did not return an instance URL');

    let adopted;
    try {
      adopted = await prisma.$transaction(async (transaction) => {
        const scratch = scratchCollision
          ? await transaction.scratchOrg.update({
            where: { id: scratchCollision.id },
            data: {
              alias: resolvedAlias,
              username,
              orgId,
              instanceUrl,
              loginUrl: details.loginUrl ?? cliOrg.loginUrl,
              expirationDate,
              devHubAlias: live.devHub,
              status: 'Active',
            },
            })
          : await transaction.scratchOrg.create({
            data: {
              alias: resolvedAlias,
              username,
              orgId,
              instanceUrl,
              loginUrl: details.loginUrl ?? cliOrg.loginUrl,
              expirationDate,
              devHubAlias: live.devHub,
              status: 'Active',
              createdBy: userId,
            },
            });
        const connection = connectionCollision
          ? await transaction.orgConnection.update({
            where: { id: connectionCollision.id },
            data: {
              alias: resolvedAlias,
              username,
              orgId,
              instanceUrl,
              loginUrl: details.loginUrl ?? cliOrg.loginUrl,
              expiresAt: expirationDate,
              type: 'scratch',
              status: 'active',
            },
            })
          : await transaction.orgConnection.create({
            data: {
              alias: resolvedAlias,
              username,
              orgId,
              instanceUrl,
              loginUrl: details.loginUrl ?? cliOrg.loginUrl,
              expiresAt: expirationDate,
              type: 'scratch',
              status: 'active',
              createdBy: userId,
            },
            });
        return { scratch, connection };
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const winner = await prisma.orgConnection.findFirst({
        where: {
          OR: [
            { alias: resolvedAlias },
            { username },
            ...(orgId ? [{ orgId }] : []),
          ],
        },
      });
      if (!winner || winner.createdBy !== userId) {
        throw new ConflictException('Scratch org was concurrently associated with another user');
      }
      adopted = { connection: winner };
    }
    return {
      imported: true,
      createdSalesforceOrg: false,
      target: this.publicTarget(adopted.connection),
    };
  }

  private async validateProviderAndSources(
    config: ScratchOrgPipelineInput,
    userId: string,
    steps: ExistingOrgEligibilityStep[],
    targetId?: string,
  ) {
    try {
      if (!config.gitSource) throw new Error('gitSource is required');
      await this.scmSources.requireActive(config.gitSource);
      steps.push({ step: 'provider', status: 'required', messages: ['SCM provider is active'] });
    } catch (error) {
      steps.push({
        step: 'provider',
        status: 'error',
        messages: [error instanceof Error ? error.message : String(error)],
      });
    }

    const customSettingsSourceId = getCustomSettingsOrgId({
      customSettingsOrgId: config.customSettingsOrgId,
      sourceOrgId: config.sourceOrgId,
      dataDeploymentOrgId: config.dataDeploymentOrgId,
    });
    const dataDeploymentSourceId = getDataDeploymentOrgId({
      dataDeploymentOrgId: config.dataDeploymentOrgId,
      customSettingsOrgId: config.customSettingsOrgId,
      sourceOrgId: config.sourceOrgId,
    });
    const customSettingsRequired = config.customSettings?.enabled === true;
    const dataSeedRequired = config.pipelineSteps?.autoRunDataSeed === true;
    const partnerSourceRequired =
      config.pipelineSteps?.autoRunPartners === true
      && config.partnerImport?.enabled === true
      && config.partnerImport.mode !== 'excel'
      && !(
        config.dataSeed?.mode === 'query_section'
        && config.dataSeed.querySection?.accountPartnerPlan
      );
    const errors: string[] = [];
    if (customSettingsRequired && !customSettingsSourceId) {
      errors.push(
        'Custom settings are enabled, but no custom settings source org is configured',
      );
    }
    if (dataSeedRequired && !dataDeploymentSourceId) {
      errors.push(
        'Automatic data seed is enabled, but no data deployment source org is configured',
      );
    }
    if (partnerSourceRequired && !dataDeploymentSourceId) {
      errors.push(
        'Automatic account partner import requires a data deployment source org',
      );
    }

    const sourceIds = [...new Set([
      config.dataDeploymentOrgId,
      config.customSettingsOrgId,
      config.sourceOrgId,
      customSettingsSourceId,
      dataDeploymentSourceId,
    ].filter((value): value is string => Boolean(value)))];
    for (const id of sourceIds) {
      const source = await prisma.orgConnection.findUnique({ where: { id } });
      if (!source || source.createdBy !== userId) {
        errors.push(`Source org ${id} was not found`);
        continue;
      }
      let usable = true;
      if (source.status !== 'active') {
        errors.push(`Source org "${source.alias}" is not active`);
        usable = false;
      }
      if (source.expiresAt && source.expiresAt <= new Date()) {
        errors.push(`Source org "${source.alias}" has expired`);
        usable = false;
      }
      if (targetId === id) errors.push(`Source org "${source.alias}" cannot also be the target`);
      if (usable) {
        try {
          await this.preparation.verifyAuthentication(source);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    steps.push({
      step: 'sources',
      status: errors.length ? 'error' : sourceIds.length ? 'required' : 'skipped',
      messages: errors.length
        ? errors
        : sourceIds.length
          ? ['All configured source orgs are active, authenticated, and caller-owned']
          : ['No source orgs are required by the configured template steps'],
    });
  }

  private async validateDevHub(
    config: Extract<ScratchOrgPipelineInput, { mode: 'create_new' }>,
    userId: string,
    steps: ExistingOrgEligibilityStep[],
  ) {
    const devHub = await prisma.orgConnection.findUnique({
      where: { alias: config.devHubAlias },
    });
    const errors: string[] = [];
    if (!devHub || devHub.createdBy !== userId) {
      errors.push(`Dev Hub "${config.devHubAlias}" was not found`);
    } else {
      if (!devHub.isDevHub) errors.push(`Org "${config.devHubAlias}" is not a Dev Hub`);
      if (devHub.status !== 'active') errors.push(`Dev Hub "${config.devHubAlias}" is not active`);
      if (devHub.expiresAt && devHub.expiresAt <= new Date()) {
        errors.push(`Dev Hub "${config.devHubAlias}" authentication has expired`);
      }
      if (!errors.length) {
        try {
          await this.preparation.verifyAuthentication(devHub);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    steps.push({
      step: 'dev_hub',
      status: errors.length ? 'error' : 'required',
      messages: errors.length
        ? errors
        : [`Dev Hub "${config.devHubAlias}" is active, authenticated, and caller-owned`],
    });
  }

  private result(
    config: ScratchOrgPipelineInput | undefined,
    target: Parameters<ExistingScratchOrgService['publicTarget']>[0] | undefined,
    steps: ExistingOrgEligibilityStep[],
    conflictRunId?: string,
  ) {
    const errors = steps.filter((step) => step.status === 'error').flatMap((step) => step.messages);
    const detailedSteps = steps.map((step) => {
      const disabledWarning =
        step.status === 'skipped'
        && step.messages.some((message) => message.includes('disabled'));
      return {
        ...step,
        required: step.status === 'required',
        skipped: step.status === 'skipped',
        warnings:
          step.status === 'warning' || disabledWarning ? [...step.messages] : [],
        errors: step.status === 'error' ? [...step.messages] : [],
      };
    });
    const warnings = detailedSteps.flatMap((step) => step.warnings);
    return {
      eligible: errors.length === 0,
      config,
      target: target ? this.publicTarget(target) : null,
      steps: detailedSteps,
      warnings,
      errors,
      conflictRunId: conflictRunId ?? null,
    };
  }

  private publicTarget(target: {
    id: string;
    alias: string;
    username: string | null;
    orgId: string | null;
    instanceUrl: string;
    status: string;
    expiresAt: Date | null;
  }) {
    return {
      id: target.id,
      alias: target.alias,
      username: target.username,
      orgId: target.orgId,
      instanceUrl: target.instanceUrl,
      status: target.status,
      expiresAt: target.expiresAt?.toISOString() ?? null,
    };
  }
}
