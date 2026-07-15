import { Global, Module } from '@nestjs/common';
import { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import { AzureScmAdapter, AzureWorkItemAdapter } from '../azure/azure.adapters';
import { AzureService } from '../azure/azure.service';
import { AzureWorkItemsService } from '../azure/azure-work-items.service';
import {
  SCM_ADAPTERS,
  WORK_ITEM_ADAPTERS,
  type ScmAdapter,
  type WorkItemAdapter,
} from './adapter.contracts';
import { ScmAdapterRegistry, WorkItemAdapterRegistry } from './adapter.registry';

@Global()
@Module({
  providers: [
    AzureIntegrationService,
    AzureService,
    AzureWorkItemsService,
    AzureScmAdapter,
    AzureWorkItemAdapter,
    {
      provide: SCM_ADAPTERS,
      inject: [AzureScmAdapter],
      useFactory: (azure: AzureScmAdapter): ScmAdapter[] => [azure],
    },
    {
      provide: WORK_ITEM_ADAPTERS,
      inject: [AzureWorkItemAdapter],
      useFactory: (azure: AzureWorkItemAdapter): WorkItemAdapter[] => [azure],
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
  ],
})
export class IntegrationAdaptersModule {}
