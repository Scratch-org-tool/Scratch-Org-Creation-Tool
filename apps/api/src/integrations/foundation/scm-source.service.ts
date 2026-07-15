import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  gitSourceConfigSchema,
  type GitSourceConfig,
  type ScmProvider,
} from '@sfcc/shared';
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
      if (
        binding.repositoryName &&
        resolved.repo !== binding.repositoryName &&
        resolved.repo !== `${binding.projectKey ?? binding.externalProjectId}/${binding.repositoryName}`
      ) {
        throw new BadRequestException('Repository does not match the selected SCM binding');
      }
      const metadata = (binding.metadata ?? {}) as Record<string, unknown>;
      const boundNamespace =
        typeof metadata.workspace === 'string' ? metadata.workspace : undefined;
      resolved = {
        ...resolved,
        connectionId: connection.id,
        namespace: resolved.namespace ?? boundNamespace,
        project: resolved.project ?? binding.projectKey ?? binding.externalProjectId,
        repositoryId: resolved.repositoryId ?? binding.repositoryId ?? undefined,
      };
    }

    if (resolved.connectionId) {
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

  private providerLabel(provider: ScmProvider): string {
    return {
      azure_devops: 'Azure DevOps',
      github: 'GitHub',
      bitbucket: 'Bitbucket',
    }[provider];
  }
}
