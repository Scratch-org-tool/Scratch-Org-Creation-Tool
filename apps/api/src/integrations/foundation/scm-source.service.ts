import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  gitSourceConfigSchema,
  type GitSourceConfig,
  type ScmProvider,
} from '@sfcc/shared';
import {
  AZURE_ENV_SCM_CONNECTION_ID,
  AZURE_ENV_WORK_ITEM_CONNECTION_ID,
} from '../../modules/integrations/azure-integration.service';
import { ScmAdapterRegistry } from './adapter.registry';

@Injectable()
export class ScmSourceService {
  constructor(private readonly registry: ScmAdapterRegistry) {}

  async resolve(source: GitSourceConfig): Promise<GitSourceConfig> {
    let resolved = gitSourceConfigSchema.parse(source);

    if (resolved.bindingId) {
      const binding = await prisma.projectBinding.findUnique({
        where: { id: resolved.bindingId },
        include: { scmConnection: true },
      });
      if (!binding?.scmConnection) {
        throw new NotFoundException('SCM project binding not found');
      }
      const connection = binding.scmConnection;
      if (connection.provider !== resolved.provider) {
        throw new BadRequestException('SCM binding provider does not match gitSource.provider');
      }
      if (resolved.connectionId && resolved.connectionId !== connection.id) {
        throw new BadRequestException('SCM binding does not belong to gitSource.connectionId');
      }
      const metadata = (binding.metadata ?? {}) as Record<string, unknown>;
      const boundNamespace =
        typeof metadata.workspace === 'string' ? metadata.workspace : undefined;
      const boundProject = binding.projectKey ?? binding.externalProjectId;
      const boundRepositoryId = binding.repositoryId ?? undefined;
      const boundRepo = binding.repositoryName ?? undefined;
      this.assertBoundValue('namespace', resolved.namespace, boundNamespace);
      this.assertBoundValue('project', resolved.project, boundProject);
      this.assertBoundValue('repositoryId', resolved.repositoryId, boundRepositoryId);
      this.assertBoundValue('repo', resolved.repo, boundRepo);
      resolved = {
        ...resolved,
        connectionId: connection.id,
        namespace: boundNamespace ?? resolved.namespace,
        project: boundProject,
        repositoryId: boundRepositoryId ?? resolved.repositoryId,
        repo: boundRepo ?? resolved.repo,
      };
    }

    if (resolved.connectionId === AZURE_ENV_WORK_ITEM_CONNECTION_ID) {
      throw new BadRequestException(
        'Azure Boards environment connection cannot be used for SCM operations',
      );
    }
    if (resolved.connectionId && resolved.connectionId !== AZURE_ENV_SCM_CONNECTION_ID) {
      const connection = await prisma.scmConnection.findUnique({
        where: { id: resolved.connectionId },
        select: { provider: true, status: true },
      });
      if (!connection) throw new NotFoundException('SCM connection not found');
      if (connection.provider !== resolved.provider) {
        throw new BadRequestException('SCM connection provider does not match gitSource.provider');
      }
      if (connection.status !== 'connected') {
        throw new BadRequestException('SCM connection is not active');
      }
    }

    return resolved;
  }

  async requireActive(source: GitSourceConfig): Promise<GitSourceConfig> {
    const resolved = await this.resolve(source);
    const status = await this.registry
      .get(resolved.provider)
      .getConnectionStatus({ connectionId: resolved.connectionId });
    if (!status.connected || status.state !== 'connected') {
      throw new BadRequestException(
        `${this.providerLabel(resolved.provider)} connection is not active`,
      );
    }
    return resolved;
  }

  async checkout(source: GitSourceConfig) {
    const resolved = await this.requireActive(source);
    return this.registry.get(resolved.provider).checkout(resolved);
  }

  private assertBoundValue(
    field: 'namespace' | 'project' | 'repositoryId' | 'repo',
    requested: string | undefined,
    bound: string | undefined,
  ): void {
    if (bound && requested && requested !== bound) {
      throw new BadRequestException(`${field} does not match the selected SCM binding`);
    }
  }

  private providerLabel(provider: ScmProvider): string {
    return {
      azure_devops: 'Azure DevOps',
      github: 'GitHub',
      bitbucket: 'Bitbucket',
    }[provider];
  }
}
