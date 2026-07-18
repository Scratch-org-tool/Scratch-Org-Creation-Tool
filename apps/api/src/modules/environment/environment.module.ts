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
import { ScratchOrgRenewalModule } from './scratch-org-renewal.module';
import { ScratchOrgEligibilityModule } from './scratch-org-eligibility.module';

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
    ScratchOrgEligibilityModule,
    ScratchOrgRenewalModule,
  ],
  controllers: [EnvironmentController],
  providers: [
    EnvironmentService,
    AzureIntegrationService,
    AzureService,
  ],
  exports: [AzureIntegrationService, AzureService, OrgConfigModule, ScratchTemplatesModule],
})
export class EnvironmentModule {}
