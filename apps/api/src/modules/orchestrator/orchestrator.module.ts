import { Module, forwardRef } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { PipelineOrchestratorService } from './pipeline-orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { JobsModule } from '../jobs/jobs.module';
import { QueueModule } from '../queue/queue.module';
import { StreamModule } from '../stream/stream.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { ScratchOrgJobModule } from '../environment/scratch-org-job.module';
import { OrgConfigModule } from '../environment/org-config.module';

@Module({
  imports: [
    JobsModule,
    forwardRef(() => QueueModule),
    StreamModule,
    DeploymentModule,
    ScratchOrgJobModule,
    OrgConfigModule,
  ],
  controllers: [OrchestratorController],
  providers: [OrchestratorService, PipelineOrchestratorService],
  exports: [OrchestratorService, PipelineOrchestratorService],
})
export class OrchestratorModule {}
