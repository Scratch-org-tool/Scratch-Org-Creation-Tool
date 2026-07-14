import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  DEFAULT_AZURE_MANIFEST_PATH,
  migrateTemplateConfig,
  sanitizeTemplateConfigForStorage,
  scratchTemplateCreateSchema,
  scratchTemplateUpdateSchema,
  validateBottlerSalesOfficeConfig,
} from '@sfcc/shared';
import { assertResourceOwner } from '../../common/user-tenancy.util';

const SYSTEM_TEMPLATE_NAME = 'CONA Full Setup';

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
      if (azure?.repo || azure?.branch) {
        await prisma.scratchPipelineTemplate.update({
          where: { id: existing.id },
          data: {
            config: sanitizeTemplateConfigForStorage({
              ...cfg,
              azureDeploy: azure.manifestPath ? { manifestPath: azure.manifestPath } : undefined,
            } as Parameters<typeof sanitizeTemplateConfigForStorage>[0]) as Prisma.InputJsonValue,
          },
        });
      }
      return;
    }

    await prisma.scratchPipelineTemplate.create({
      data: {
        name: SYSTEM_TEMPLATE_NAME,
        description: 'Default CONA scratch pipeline: Azure deploy, org config, bundled custom settings, data seed, and users.',
        isSystem: true,
        createdById: null,
        config: {
          template: 'config/project-scratch-def.json',
          duration: 7,
          installPackage: true,
          azureDeploy: { manifestPath: DEFAULT_AZURE_MANIFEST_PATH },
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
            autoRunUsers: true,
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
      alias: string;
      devHubAlias: string;
      sourceOrgId?: string;
      dataDeploymentOrgId?: string;
      customSettingsOrgId?: string;
      templateId?: string;
      azureDeploy: { project?: string; repo: string; branch: string; manifestPath?: string };
      installPackage?: boolean;
      duration?: number;
      description?: string;
    },
  ) {
    const tmplAzure = templateConfig.azureDeploy as { manifestPath?: string } | undefined;
    const tmpl = migrateTemplateConfig(templateConfig as Parameters<typeof migrateTemplateConfig>[0]);
    const dataDeploymentOrgId =
      overrides.dataDeploymentOrgId ?? overrides.sourceOrgId ?? tmpl.dataDeploymentOrgId ?? tmpl.sourceOrgId;
    const customSettingsOrgId =
      overrides.customSettingsOrgId ?? overrides.sourceOrgId ?? tmpl.customSettingsOrgId ?? tmpl.sourceOrgId;
    return {
      ...tmpl,
      alias: overrides.alias,
      devHubAlias: overrides.devHubAlias,
      duration: overrides.duration ?? tmpl.duration,
      description: overrides.description,
      sourceOrgId: dataDeploymentOrgId,
      dataDeploymentOrgId,
      customSettingsOrgId,
      templateId: overrides.templateId,
      definitionFile: tmpl.template ?? 'config/project-scratch-def.json',
      azureDeploy: {
        project: overrides.azureDeploy.project,
        repo: overrides.azureDeploy.repo,
        branch: overrides.azureDeploy.branch,
        manifestPath: overrides.azureDeploy.manifestPath ?? tmplAzure?.manifestPath,
      },
      skipSteps: [],
    };
  }
}
