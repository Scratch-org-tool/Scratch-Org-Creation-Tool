import { Module, forwardRef } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { PipelineOrchestratorService } from './pipeline-orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { JobsModule } from '../jobs/jobs.module';
import { QueueModule } from '../queue/queue.module';
import { StreamModule } from '../stream/stream.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { ScratchOrgJobModule } from '../environment/scratch-org-job.module';
import { AzureService } from '../../integrations/azure/azure.service';
import { AzureIntegrationService } from '../integrations/azure-integration.service';

@Module({
  imports: [JobsModule, forwardRef(() => QueueModule), StreamModule, DeploymentModule, ScratchOrgJobModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService, PipelineOrchestratorService, AzureIntegrationService, AzureService],
  exports: [OrchestratorService, PipelineOrchestratorService],
})
export class OrchestratorModule {}
