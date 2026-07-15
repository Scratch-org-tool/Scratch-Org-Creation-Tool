import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import { AzureScmAdapter, AzureWorkItemAdapter } from '../azure/azure.adapters';
import { AzureService } from '../azure/azure.service';
import { AzureWorkItemsService } from '../azure/azure-work-items.service';
import { AtlassianConnectionStore } from '../atlassian/atlassian-connection.store';
import { ATLASSIAN_FETCH } from '../atlassian/atlassian-http.client';
import { BitbucketScmAdapter } from '../bitbucket/bitbucket.adapter';
import { JiraWorkItemAdapter } from '../jira/jira.adapter';
import { IntegrationAdminController } from '../../modules/integrations/integration-admin.controller';
import { IntegrationAdminService } from '../../modules/integrations/integration-admin.service';
import { IntegrationWebhookController } from '../../modules/integrations/integration-webhook.controller';
import { IntegrationWebhookService } from '../../modules/integrations/integration-webhook.service';
import { IntegrationsController } from '../../modules/integrations/integrations.controller';
import { IntegrationsService } from '../../modules/integrations/integrations.service';
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
import { IntegrationErrorFilter } from './integration-error.filter';

@Global()
@Module({
  controllers: [
    ProviderIntegrationController,
    GitHubWebhookController,
    IntegrationAdminController,
    IntegrationWebhookController,
    IntegrationsController,
  ],
  providers: [
    AzureIntegrationService,
    AzureService,
    AzureWorkItemsService,
    AzureScmAdapter,
    AzureWorkItemAdapter,
    { provide: ATLASSIAN_FETCH, useValue: fetch },
    AtlassianConnectionStore,
    BitbucketScmAdapter,
    JiraWorkItemAdapter,
    IntegrationAdminService,
    IntegrationWebhookService,
    IntegrationsService,
    { provide: APP_FILTER, useClass: IntegrationErrorFilter },
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
      inject: [AzureScmAdapter, GitHubScmAdapter, BitbucketScmAdapter],
      useFactory: (
        azure: AzureScmAdapter,
        github: GitHubScmAdapter,
        bitbucket: BitbucketScmAdapter,
      ): ScmAdapter[] => [
        azure,
        github,
        bitbucket,
      ],
    },
    {
      provide: WORK_ITEM_ADAPTERS,
      inject: [AzureWorkItemAdapter, GitHubWorkItemAdapter, JiraWorkItemAdapter],
      useFactory: (
        azure: AzureWorkItemAdapter,
        github: GitHubWorkItemAdapter,
        jira: JiraWorkItemAdapter,
      ): WorkItemAdapter[] => [azure, github, jira],
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
    BitbucketScmAdapter,
    JiraWorkItemAdapter,
    AtlassianConnectionStore,
  ],
})
export class IntegrationAdaptersModule {}
