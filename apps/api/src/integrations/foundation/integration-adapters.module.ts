import { Global, Module } from '@nestjs/common';
import { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import { AzureScmAdapter, AzureWorkItemAdapter } from '../azure/azure.adapters';
import { AzureService } from '../azure/azure.service';
import { AzureWorkItemsService } from '../azure/azure-work-items.service';
import {
  GITHUB_FETCH,
  GITHUB_SLEEP,
  GitHubApiClient,
} from '../github/github-api.client';
import {
  GITHUB_AUTH_FETCH,
  GitHubAuthService,
} from '../github/github-auth.service';
import { DisabledGitHubAttachmentStore } from '../github/github-attachment.store';
import {
  GitHubWebhookController,
  ProviderIntegrationController,
} from '../github/github.controllers';
import { GitHubIntegrationService } from '../github/github-integration.service';
import {
  defaultGitHubExecFile,
  GITHUB_EXEC_FILE,
  GitHubCheckoutService,
  GitHubScmAdapter,
} from '../github/github-scm.adapter';
import { GitHubWebhookService } from '../github/github-webhook.service';
import { GitHubWorkItemAdapter } from '../github/github-work-item.adapter';
import {
  SCM_ADAPTERS,
  WORK_ITEM_ADAPTERS,
  type ScmAdapter,
  type WorkItemAdapter,
} from './adapter.contracts';
import { ScmAdapterRegistry, WorkItemAdapterRegistry } from './adapter.registry';

@Global()
@Module({
  controllers: [
    ProviderIntegrationController,
    GitHubWebhookController,
  ],
  providers: [
    AzureIntegrationService,
    AzureService,
    AzureWorkItemsService,
    AzureScmAdapter,
    AzureWorkItemAdapter,
    { provide: GITHUB_AUTH_FETCH, useValue: fetch },
    { provide: GITHUB_FETCH, useValue: fetch },
    {
      provide: GITHUB_SLEEP,
      useValue: (milliseconds: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
    },
    { provide: GITHUB_EXEC_FILE, useValue: defaultGitHubExecFile },
    GitHubAuthService,
    GitHubApiClient,
    GitHubIntegrationService,
    GitHubCheckoutService,
    GitHubScmAdapter,
    DisabledGitHubAttachmentStore,
    GitHubWorkItemAdapter,
    GitHubWebhookService,
    {
      provide: SCM_ADAPTERS,
      inject: [AzureScmAdapter, GitHubScmAdapter],
      useFactory: (
        azure: AzureScmAdapter,
        github: GitHubScmAdapter,
      ): ScmAdapter[] => [
        azure,
        github,
      ],
    },
    {
      provide: WORK_ITEM_ADAPTERS,
      inject: [AzureWorkItemAdapter, GitHubWorkItemAdapter],
      useFactory: (
        azure: AzureWorkItemAdapter,
        github: GitHubWorkItemAdapter,
      ): WorkItemAdapter[] => [azure, github],
    },
    ScmAdapterRegistry,
    WorkItemAdapterRegistry,
  ],
  exports: [
    SCM_ADAPTERS,
    WORK_ITEM_ADAPTERS,
    ScmAdapterRegistry,
    WorkItemAdapterRegistry,
    AzureScmAdapter,
    AzureWorkItemAdapter,
    GitHubIntegrationService,
    GitHubScmAdapter,
    GitHubWorkItemAdapter,
  ],
})
export class IntegrationAdaptersModule {}
