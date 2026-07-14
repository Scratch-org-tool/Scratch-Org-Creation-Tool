import { Module } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { EnvironmentController } from './environment.controller';
import { OrgConfigModule } from './org-config.module';
import { ScratchOrgJobModule } from './scratch-org-job.module';
import { QueueModule } from '../queue/queue.module';
import { JobsModule } from '../jobs/jobs.module';
import { StreamModule } from '../stream/stream.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { OrgsModule } from '../orgs/orgs.module';
import { ScratchTemplatesModule } from '../scratch-templates/scratch-templates.module';
import { DataCoreModule } from '../data/data-core.module';
import { AzureService } from '../../integrations/azure/azure.service';
import { AzureIntegrationService } from '../integrations/azure-integration.service';

@Module({
  imports: [
    OrgConfigModule,
    ScratchOrgJobModule,
    QueueModule,
    JobsModule,
    StreamModule,
    OrchestratorModule,
    OrgsModule,
    ScratchTemplatesModule,
    DataCoreModule,
  ],
  controllers: [EnvironmentController],
  providers: [EnvironmentService, AzureIntegrationService, AzureService],
  exports: [AzureIntegrationService, AzureService, OrgConfigModule, ScratchTemplatesModule],
})
export class EnvironmentModule {}
