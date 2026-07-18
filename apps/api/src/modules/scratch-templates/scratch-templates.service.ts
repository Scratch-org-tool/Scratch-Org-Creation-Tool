import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  DEFAULT_AZURE_MANIFEST_PATH,
  normalizeGitSourceConfig,
  type GitSourceConfig,
  migrateTemplateConfig,
  migrateTemplateConfigToV2,
  scratchOrgPipelineSchema,
  sanitizeTemplateConfigForStorage,
  scratchTemplateCreateSchema,
  scratchTemplateUpdateSchema,
  validateBottlerSalesOfficeConfig,
} from '@sfcc/shared';
import { assertResourceOwner } from '../../common/user-tenancy.util';

const SYSTEM_TEMPLATE_NAME = 'CONA Full Setup';
const SYSTEM_TEMPLATE_DESCRIPTION =
  'Default CONA scratch pipeline: metadata, org config, bundled custom settings, and data seed. User provisioning runs when concrete users are configured.';

@Injectable()
export class ScratchTemplatesService implements OnModuleInit {
  async onModuleInit() {
    await this.ensureSystemTemplate();
  }

  private async ensureSystemTemplate() {
    const existing = await prisma.scratchPipelineTemplate.findFirst({
      where: { isSystem: true },
    });
    if (existing) {
      const cfg = existing.config as Record<string, unknown>;
      const azure = cfg.azureDeploy as { repo?: string; branch?: string; manifestPath?: string } | undefined;
      const git = cfg.gitSource as Partial<GitSourceConfig> | undefined;
      const provisioning = cfg.userProvisioning as {
        users?: unknown[];
        slots?: unknown[];
        userGenerators?: unknown[];
      } | undefined;
      const hasUsers = Boolean(
        provisioning?.users?.length
        || provisioning?.slots?.length
        || provisioning?.userGenerators?.length,
      );
      const steps = cfg.pipelineSteps as {
        autoRunDataSeed?: boolean;
        autoRunPartners?: boolean;
        autoRunUsers?: boolean;
      } | undefined;
      if (
        azure?.repo
        || azure?.branch
        || !git?.provider
        || (!hasUsers && steps?.autoRunUsers === true)
        || existing.description !== SYSTEM_TEMPLATE_DESCRIPTION
      ) {
        await prisma.scratchPipelineTemplate.update({
          where: { id: existing.id },
          data: {
            description: SYSTEM_TEMPLATE_DESCRIPTION,
            config: sanitizeTemplateConfigForStorage({
              ...cfg,
              azureDeploy: azure?.manifestPath ? { manifestPath: azure.manifestPath } : undefined,
              gitSource: {
                ...git,
                provider: git?.provider ?? 'azure_devops',
                manifestPath: git?.manifestPath ?? azure?.manifestPath,
              },
              pipelineSteps: {
                ...steps,
                ...(!hasUsers ? { autoRunUsers: false } : {}),
              },
            } as Parameters<typeof sanitizeTemplateConfigForStorage>[0]) as Prisma.InputJsonValue,
          },
        });
      }
      return;
    }

    await prisma.scratchPipelineTemplate.create({
      data: {
        name: SYSTEM_TEMPLATE_NAME,
        description: SYSTEM_TEMPLATE_DESCRIPTION,
        isSystem: true,
        createdById: null,
        config: {
          template: 'config/project-scratch-def.json',
          duration: 7,
          installPackage: true,
          azureDeploy: { manifestPath: DEFAULT_AZURE_MANIFEST_PATH },
          gitSource: {
            provider: 'azure_devops',
            manifestPath: DEFAULT_AZURE_MANIFEST_PATH,
          },
          permissionSets: [],
          orgConfig: {
            upsertQueueIds: true,
            upsertDomainFields: true,
            upsertRequestId: true,
          },
          customSettings: { enabled: true, mode: 'bundled' },
          dataSeed: {
            datasets: ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'],
            mode: 'hybrid',
          },
          partnerImport: {
            enabled: false,
            mode: 'org_to_org_matched',
            bottler: '5000',
            perOffice: 20,
            matchOrgDistribution: true,
            salesOfficeConfig: {
              bottler: '5000',
              label: 'Northeast',
              perOfficePartnerLimit: 20,
              roles: ['ZR'],
              offices: ['S003', 'S008', 'S010'],
            },
          },
          userProvisioning: {
            templates: [
              {
                id: 'onboarding-admin',
                label: 'Onboarding Admin',
                bottler: '5000',
                role: 'Master Data',
                modules: ['Onboarding'],
                locations: ['Northeast'],
              },
            ],
            slots: [],
          },
          pipelineSteps: {
            autoRunDataSeed: true,
            autoRunPartners: false,
            autoRunUsers: false,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  async list(userId: string) {
    return prisma.scratchPipelineTemplate.findMany({
      where: {
        OR: [{ isSystem: true }, { createdById: userId }],
      },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(id: string, userId: string) {
    const template = await prisma.scratchPipelineTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (!template.isSystem && template.createdById !== userId) {
      throw new NotFoundException('Template not found');
    }
    return {
      ...template,
      config: migrateTemplateConfig(template.config as Parameters<typeof migrateTemplateConfig>[0]),
    };
  }

  validateBottlerConfig(body: unknown) {
    const result = validateBottlerSalesOfficeConfig(body);
    if (!result.valid) {
      throw new BadRequestException(result.errors);
    }
    return { normalized: result.normalized };
  }

  private normalizeConfig(config: Parameters<typeof sanitizeTemplateConfigForStorage>[0]) {
    return sanitizeTemplateConfigForStorage(migrateTemplateConfig(config));
  }

  async create(body: unknown, userId: string) {
    const input = scratchTemplateCreateSchema.parse(body);
    const config = this.normalizeConfig(input.config);
    return prisma.scratchPipelineTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        isSystem: false,
        createdById: userId,
        config: config as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, body: unknown, userId: string) {
    const template = await prisma.scratchPipelineTemplate.findUnique({ where: { id } });
    if (!template || template.isSystem) throw new NotFoundException('Template not found');
    assertResourceOwner({ createdBy: template.createdById ?? '' }, userId, 'Template');

    const input = scratchTemplateUpdateSchema.parse(body);
    const config = input.config ? this.normalizeConfig(input.config) : undefined;
    return prisma.scratchPipelineTemplate.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(config ? { config: config as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(id: string, userId: string) {
    const template = await prisma.scratchPipelineTemplate.findUnique({ where: { id } });
    if (!template || template.isSystem) throw new NotFoundException('Template not found');
    assertResourceOwner({ createdBy: template.createdById ?? '' }, userId, 'Template');
    await prisma.scratchPipelineTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  async duplicate(id: string, userId: string) {
    const source = await this.get(id, userId);
    return prisma.scratchPipelineTemplate.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        isSystem: false,
        createdById: userId,
        config: source.config as Prisma.InputJsonValue,
      },
    });
  }

  mergeTemplateWithLaunch(
    templateConfig: Record<string, unknown>,
    overrides: {
      mode?: 'create_new' | 'configure_existing';
      alias?: string;
      devHubAlias?: string;
      existingOrgConnectionId?: string;
      existingOrgOptions?: {
        verifyAuthentication?: boolean;
        ensureRequiredPackage?: boolean;
      };
      sourceOrgId?: string;
      dataDeploymentOrgId?: string;
      customSettingsOrgId?: string;
      templateId?: string;
      gitSource?: GitSourceConfig;
      azureDeploy?: { project?: string; repo: string; branch: string; manifestPath?: string };
      installPackage?: boolean;
      duration?: number;
      description?: string;
    },
  ) {
    const tmplAzure = templateConfig.azureDeploy as { manifestPath?: string } | undefined;
    const tmpl = migrateTemplateConfig(templateConfig as Parameters<typeof migrateTemplateConfig>[0]);
    const source = normalizeGitSourceConfig({
      gitSource: overrides.gitSource,
      azureDeploy: overrides.azureDeploy,
    }).gitSource;
    if (!source) throw new BadRequestException('gitSource or azureDeploy is required');
    const gitSource = {
      ...(tmpl.gitSource ?? {}),
      ...source,
      manifestPath:
        source.manifestPath ?? tmpl.gitSource?.manifestPath ?? tmplAzure?.manifestPath,
    } as GitSourceConfig;
    const legacyDataOverride = templateConfig.dataDeploymentOrgId == null
      ? overrides.sourceOrgId
      : undefined;
    const legacySettingsOverride = templateConfig.customSettingsOrgId == null
      ? overrides.sourceOrgId
      : undefined;
    const dataDeploymentOrgId =
      overrides.dataDeploymentOrgId ?? legacyDataOverride ?? tmpl.dataDeploymentOrgId;
    const customSettingsOrgId =
      overrides.customSettingsOrgId ?? legacySettingsOverride ?? tmpl.customSettingsOrgId;
    const hasUsers = Boolean(
      tmpl.userProvisioning?.users?.length
      || tmpl.userProvisioning?.slots?.length
      || tmpl.userProvisioning?.userGenerators?.length,
    );
    const installPackage = overrides.installPackage ?? tmpl.installPackage;
    return {
      ...tmpl,
      mode: overrides.mode ?? 'create_new',
      alias: overrides.alias,
      devHubAlias: overrides.devHubAlias,
      existingOrgConnectionId: overrides.existingOrgConnectionId,
      existingOrgOptions: overrides.existingOrgOptions,
      duration: overrides.duration ?? tmpl.duration,
      installPackage,
      description: overrides.description,
      sourceOrgId: dataDeploymentOrgId,
      dataDeploymentOrgId,
      customSettingsOrgId,
      templateId: overrides.templateId,
      definitionFile: tmpl.template ?? 'config/project-scratch-def.json',
      gitSource,
      azureDeploy: gitSource.provider === 'azure_devops'
        ? {
            project: gitSource.project ?? gitSource.namespace,
            repo: gitSource.repo,
            branch: gitSource.branch,
            manifestPath: gitSource.manifestPath,
          }
        : undefined,
      skipSteps: installPackage ? [] : ['installPackages'],
      pipelineSteps: {
        ...tmpl.pipelineSteps,
        ...(hasUsers ? {} : { autoRunUsers: false }),
      },
    };
  }

  /** Build the immutable run snapshot from the stored template, never client template fields. */
  async resolveLaunch(body: Record<string, unknown>, userId: string) {
    const templateId = typeof body.templateId === 'string' ? body.templateId : undefined;
    if (!templateId) {
      return scratchOrgPipelineSchema.parse(body);
    }
    const template = await this.get(templateId, userId);
    let authoritativeConfig = migrateTemplateConfigToV2(
      template.config as Parameters<typeof migrateTemplateConfigToV2>[0],
    );
    if (body.runtimeEmailPoolOverride !== undefined) {
      authoritativeConfig = this.applyRuntimeEmailPool(
        authoritativeConfig,
        body.runtimeEmailPoolOverride,
      );
    }
    const merged = this.mergeTemplateWithLaunch(
      authoritativeConfig as Record<string, unknown>,
      {
        mode: body.mode === 'configure_existing' ? 'configure_existing' : 'create_new',
        alias: typeof body.alias === 'string' ? body.alias : undefined,
        devHubAlias: typeof body.devHubAlias === 'string' ? body.devHubAlias : undefined,
        existingOrgConnectionId: body.existingOrgConnectionId as string | undefined,
        existingOrgOptions: body.existingOrgOptions as {
          verifyAuthentication?: boolean;
          ensureRequiredPackage?: boolean;
        } | undefined,
        sourceOrgId: body.sourceOrgId as string | undefined,
        dataDeploymentOrgId: body.dataDeploymentOrgId as string | undefined,
        customSettingsOrgId: body.customSettingsOrgId as string | undefined,
        templateId,
        gitSource: body.gitSource as GitSourceConfig | undefined,
        azureDeploy: body.azureDeploy as {
          project?: string;
          repo: string;
          branch: string;
          manifestPath?: string;
        } | undefined,
        installPackage: body.installPackage as boolean | undefined,
        duration: body.duration as number | undefined,
        description: body.description as string | undefined,
      },
    );
    return scratchOrgPipelineSchema.parse(merged);
  }

  private applyRuntimeEmailPool(
    config: Parameters<typeof migrateTemplateConfigToV2>[0],
    value: unknown,
  ) {
    if (!value || typeof value !== 'object' || !Array.isArray((value as { emails?: unknown }).emails)) {
      throw new BadRequestException('runtimeEmailPoolOverride.emails must be an array');
    }
    const rawEmails = (value as { emails: unknown[] }).emails;
    if (!rawEmails.every((email) => typeof email === 'string')) {
      throw new BadRequestException('runtimeEmailPoolOverride.emails must contain strings');
    }
    const emails = rawEmails.map((email) => (email as string).trim().toLowerCase());
    if (emails.length === 0 || emails.length > 1000) {
      throw new BadRequestException(
        'runtimeEmailPoolOverride.emails must contain between 1 and 1000 emails',
      );
    }
    if (emails.some((email) => !email)) {
      throw new BadRequestException('runtimeEmailPoolOverride.emails cannot contain blank values');
    }
    if (new Set(emails).size !== emails.length) {
      throw new BadRequestException('runtimeEmailPoolOverride.emails contains duplicate emails');
    }
    for (const email of emails) {
      if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new BadRequestException(`Invalid runtime email: ${email}`);
      }
    }
    if (!config.userProvisioning?.teams?.length) {
      throw new BadRequestException('Template has no team email pool to override');
    }
    return {
      ...config,
      userProvisioning: {
        ...config.userProvisioning,
        teams: config.userProvisioning.teams.map((team) => ({
          ...team,
          emailPool: { ...team.emailPool, emails },
        })),
      },
    };
  }
}
