import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { JobsModule } from '../jobs/jobs.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [JobsModule, OrchestratorModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
