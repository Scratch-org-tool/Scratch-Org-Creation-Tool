import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  scratchOrgAdoptSchema,
  type ScratchOrgPipelineInput,
} from '@sfcc/shared';
import { createSfCliClient, type SfOrgInfo } from '@sfcc/sf-cli';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import { ScratchTemplatesService } from '../scratch-templates/scratch-templates.service';
import { ScratchOrgPreparationService } from './scratch-org-preparation.service';

type EligibilityStatus = 'required' | 'skipped' | 'warning' | 'error';

export interface ExistingOrgEligibilityStep {
  step:
    | 'template'
    | 'target'
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
] as const;

@Injectable()
export class ExistingScratchOrgService {
  private readonly sfCli = createSfCliClient({
    cwd: process.env.SF_PROJECT_ROOT ?? process.cwd(),
  });

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
      await this.validateProviderAndSources(config, userId, steps);
      return this.result(config, undefined, steps);
    }

    const target = await prisma.orgConnection.findUnique({
      where: { id: config.existingOrgConnectionId },
    });
    const scratch = target
      ? await prisma.scratchOrg.findUnique({ where: { alias: target.alias } })
      : null;
    const now = new Date();
    const targetErrors: string[] = [];
    if (!target || target.createdBy !== userId) {
      targetErrors.push('Existing scratch org target was not found');
    } else {
      if (target.type !== 'scratch') targetErrors.push('Selected org is not a scratch org');
      if (target.status !== 'active') targetErrors.push('Selected scratch org is not active');
      if (target.expiresAt && target.expiresAt <= now) targetErrors.push('Selected scratch org has expired');
      if (scratch) {
        if (scratch.createdBy !== userId) {
          targetErrors.push('Scratch org association is not owned by the caller');
        }
        if (
          (scratch.orgId && target.orgId && scratch.orgId !== target.orgId)
          || (scratch.username && target.username && scratch.username !== target.username)
        ) {
          targetErrors.push('Scratch org association does not match the selected connection');
        }
        if (scratch.status.toLowerCase() !== 'active') {
          targetErrors.push('Associated scratch org is not active');
        }
        if (scratch.expirationDate && scratch.expirationDate <= now) {
          targetErrors.push('Associated scratch org has expired');
        }
      }
    }
    steps.push({
      step: 'target',
      status: targetErrors.length ? 'error' : 'required',
      messages: targetErrors.length ? targetErrors : ['Caller-owned active scratch org selected'],
    });

    if (target && !targetErrors.length) {
      const options = config.existingOrgOptions;
      if (options.verifyAuthentication) {
        try {
          await this.preparation.verifyAuthentication(target);
          steps.push({
            step: 'authentication',
            status: 'required',
            messages: ['Salesforce CLI authentication verified'],
          });
        } catch (error) {
          steps.push({
            step: 'authentication',
            status: 'error',
            messages: [error instanceof Error ? error.message : String(error)],
          });
        }
      } else {
        steps.push({
          step: 'authentication',
          status: 'skipped',
          messages: ['Authentication verification was disabled for this launch'],
        });
      }

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
          createdBy: userId,
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
    const listed = await this.sfCli.listOrgs();
    if (!listed.success) {
      throw new BadRequestException(listed.error ?? 'Unable to list Salesforce CLI orgs');
    }
    const cliScratchOrgs = (listed.data?.result?.scratchOrgs ?? []) as SfOrgInfo[];
    const cliOrg = cliScratchOrgs.find((org) => org.alias === alias || org.username === alias);
    if (!cliOrg) {
      throw new NotFoundException(`Authenticated scratch org alias "${alias}" was not found`);
    }

    const display = await this.sfCli.displayOrg(alias);
    if (!display.success) {
      throw new BadRequestException(`Scratch org "${alias}" is not authenticated in Salesforce CLI`);
    }
    const details = (display.data as { result?: SfOrgInfo })?.result ?? cliOrg;
    const resolvedAlias = cliOrg.alias ?? alias;
    const username = details.username ?? cliOrg.username;
    if (!username) throw new BadRequestException('Salesforce CLI did not return a scratch org username');
    const orgId = details.orgId ?? details.id ?? cliOrg.orgId ?? cliOrg.id;

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

    const expirationDate = details.expirationDate
      ? new Date(details.expirationDate)
      : cliOrg.expirationDate
        ? new Date(cliOrg.expirationDate)
        : null;
    if (expirationDate && Number.isNaN(expirationDate.getTime())) {
      throw new BadRequestException('Salesforce CLI returned an invalid scratch org expiration date');
    }
    if (expirationDate && expirationDate <= new Date()) {
      throw new BadRequestException('Scratch org has expired');
    }
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

    const sourceIds = [...new Set([
      config.dataDeploymentOrgId,
      config.customSettingsOrgId,
      config.sourceOrgId,
    ].filter((value): value is string => Boolean(value)))];
    const errors: string[] = [];
    for (const id of sourceIds) {
      const source = await prisma.orgConnection.findUnique({ where: { id } });
      if (!source || source.createdBy !== userId) {
        errors.push(`Source org ${id} was not found`);
        continue;
      }
      if (config.mode === 'configure_existing') {
        if (source.status !== 'active') errors.push(`Source org "${source.alias}" is not active`);
        if (source.expiresAt && source.expiresAt <= new Date()) {
          errors.push(`Source org "${source.alias}" has expired`);
        }
        if (targetId === id) errors.push(`Source org "${source.alias}" cannot also be the target`);
      }
    }
    steps.push({
      step: 'sources',
      status: errors.length ? 'error' : sourceIds.length ? 'required' : 'skipped',
      messages: errors.length
        ? errors
        : sourceIds.length
          ? ['All configured source orgs are active and caller-owned']
          : ['No source orgs are required by this launch'],
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
